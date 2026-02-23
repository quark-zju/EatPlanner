import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { solvePlanOptions } from "../core";
import type {
  Food,
  Goal,
  Nutrition,
  PantryItem,
  PlanConstraints,
  PlanOption,
} from "../core";
import {
  downloadTextFile,
  parseImportText,
  serializeExport,
} from "../storage/exportImport";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  isGoogleDriveConnected,
  loadFromGoogleDrive,
  saveToGoogleDrive,
} from "../storage/googleDrive";
import {
  APP_STATE_STORAGE_KEY,
  defaultAppStateMap,
  fromAppStateMap,
  getRollingWindowStartISO,
  isAppState,
  newFoodId,
  normalizeAppState,
  shiftLocalDateISO,
  toAppStateMap,
  toLocalDateISO,
  type AppState,
  type AppStateMap,
  type DraftItem,
  type HistoryDayRecord,
  type LocalDateISO,
  type UiTab,
} from "./appState";
import { inferFoodIconFromName } from "./foodIcons";

const DEFAULT_DRIVE_CLIENT_ID =
  "775455628972-haf8lsiavs1u6ncpui8f20ac0orkh4nf.apps.googleusercontent.com";
const EXPORT_FILENAME = "eat-planner-export.json";
const debugDrive = import.meta.env.DEV && import.meta.env.MODE !== "test";
const logDrive = (...args: unknown[]) => {
  if (debugDrive) {
    console.log("[drive-atom]", ...args);
  }
};

const emptyNutrition = (): Nutrition => ({
  carbs: 0,
  fat: 0,
  protein: 0,
  calories: 0,
});

const clampNonNegative = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
};

const calculateDraftTotals = (items: DraftItem[]): Nutrition => {
  return items.reduce<Nutrition>(
    (totals, item) => {
      const qty = clampNonNegative(item.quantity);
      totals.carbs += item.nutritionPerUnitSnapshot.carbs * qty;
      totals.fat += item.nutritionPerUnitSnapshot.fat * qty;
      totals.protein += item.nutritionPerUnitSnapshot.protein * qty;
      totals.calories =
        (totals.calories ?? 0) + (item.nutritionPerUnitSnapshot.calories ?? 0) * qty;
      return totals;
    },
    emptyNutrition()
  );
};

const calculateDraftPrice = (items: DraftItem[]) => {
  let priceLowerBound = 0;
  let hasUnknownPrice = false;

  for (const item of items) {
    const qty = clampNonNegative(item.quantity);
    if (qty <= 0) {
      continue;
    }
    if (item.pricePerUnitSnapshot === undefined) {
      hasUnknownPrice = true;
    } else {
      priceLowerBound += item.pricePerUnitSnapshot * qty;
    }
  }

  return { priceLowerBound, hasUnknownPrice };
};

const toDraftItemsFromOption = (state: AppState, option: PlanOption): DraftItem[] => {
  return Object.entries(option.servings)
    .filter(([, amount]) => amount > 0)
    .map(([foodId, amount]) => {
      const food = state.foods.find((f) => f.id === foodId);
      return {
        foodId,
        foodNameSnapshot: food?.name ?? foodId,
        foodIconSnapshot: food?.icon,
        unitSnapshot: food?.unit ?? "serving",
        nutritionPerUnitSnapshot: food?.nutritionPerUnit ?? {
          carbs: 0,
          fat: 0,
          protein: 0,
        },
        quantity: amount,
        pricePerUnitSnapshot: food?.price,
      };
    });
};

const appStateMapStorage = {
  getItem: (key: string, initialValue: AppStateMap): AppStateMap => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return initialValue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (isAppState(parsed)) {
        return toAppStateMap(parsed);
      }
      return initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem: (key: string, newValue: AppStateMap) => {
    const plain = fromAppStateMap(newValue);
    localStorage.setItem(key, JSON.stringify(plain));
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

export const appStateMapAtom = atomWithStorage<AppStateMap>(
  APP_STATE_STORAGE_KEY,
  defaultAppStateMap,
  appStateMapStorage,
  { getOnInit: true }
);

export const appStateAtom = atom(
  (get) => fromAppStateMap(get(appStateMapAtom)),
  (_get, set, nextState: AppState) => {
    set(appStateMapAtom, toAppStateMap(normalizeAppState(nextState)));
  }
);

export const planOptionsAtom = atom<PlanOption[]>([]);
export const solvingAtom = atom(false);
export const errorAtom = atom<string | null>(null);
export const noticeAtom = atom<string | null>(null);
export const driveConnectedAtom = atom(isGoogleDriveConnected());
export const driveBusyAtom = atom(false);

export const activeTabAtom = atom(
  (get) => get(appStateAtom).ui.activeTab,
  (get, set, tab: UiTab) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      ui: {
        ...state.ui,
        activeTab: tab,
      },
    });
  }
);

export const setHistoryWindowAtom = atom(
  null,
  (get, set, direction: "prev" | "next" | "today") => {
    const state = get(appStateAtom);
    let nextStart = state.ui.historyWindowStartISO;
    if (direction === "prev") {
      nextStart = shiftLocalDateISO(nextStart, -30);
    } else if (direction === "next") {
      nextStart = shiftLocalDateISO(nextStart, 30);
    } else {
      nextStart = getRollingWindowStartISO();
    }

    set(appStateAtom, {
      ...state,
      ui: {
        ...state.ui,
        historyWindowStartISO: nextStart,
        selectedHistoryDateISO: undefined,
      },
    });
  }
);

export const setSelectedHistoryDateAtom = atom(
  null,
  (get, set, dateISO: LocalDateISO | undefined) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      ui: {
        ...state.ui,
        selectedHistoryDateISO: dateISO,
      },
    });
  }
);

export const setDraftDateAtom = atom(null, (get, set, dateISO: LocalDateISO) => {
  const state = get(appStateAtom);
  set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      draftDateISO: dateISO,
    },
  });
});

export const selectPlanOptionToDraftAtom = atom(
  null,
  (get, set, payload: { optionIndex: number; dateISO?: LocalDateISO }) => {
    const state = get(appStateAtom);
    const options = get(planOptionsAtom);
    const option = options[payload.optionIndex];
    if (!option) {
      set(errorAtom, "Selected plan option was not found.");
      return;
    }

    const items = toDraftItemsFromOption(state, option);
    if (items.length === 0) {
      set(errorAtom, "Selected plan has no items.");
      return;
    }

    set(appStateAtom, {
      ...state,
      todayDraft: {
        selectedOptionId: `${Date.now()}-${payload.optionIndex}`,
        draftDateISO: payload.dateISO ?? state.todayDraft.draftDateISO,
        items,
        totals: calculateDraftTotals(items),
      },
    });
    set(errorAtom, null);
    set(noticeAtom, "Plan loaded into draft editor.");
  }
);

export const updateDraftQuantityAtom = atom(
  null,
  (get, set, payload: { foodId: string; quantity: number }) => {
    const state = get(appStateAtom);
    const nextItems = state.todayDraft.items.map((item) =>
      item.foodId === payload.foodId
        ? { ...item, quantity: clampNonNegative(payload.quantity) }
        : item
    );

    set(appStateAtom, {
      ...state,
      todayDraft: {
        ...state.todayDraft,
        items: nextItems,
        totals: calculateDraftTotals(nextItems),
      },
    });
  }
);

export const addDraftFoodFromPantryAtom = atom(null, (get, set, foodId: string) => {
  const state = get(appStateAtom);
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) {
    set(errorAtom, "Selected pantry food was not found.");
    return;
  }

  const existing = state.todayDraft.items.find((item) => item.foodId === foodId);
  const nextItems = existing
    ? state.todayDraft.items.map((item) =>
        item.foodId === foodId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    : [
        ...state.todayDraft.items,
        {
          foodId: food.id,
          foodNameSnapshot: food.name,
          foodIconSnapshot: food.icon,
          unitSnapshot: food.unit,
          nutritionPerUnitSnapshot: food.nutritionPerUnit,
          quantity: 1,
          pricePerUnitSnapshot: food.price,
        },
      ];

  set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      items: nextItems,
      totals: calculateDraftTotals(nextItems),
    },
  });
  set(errorAtom, null);
});

export const removeDraftItemAtom = atom(null, (get, set, foodId: string) => {
  const state = get(appStateAtom);
  const nextItems = state.todayDraft.items.filter((item) => item.foodId !== foodId);
  set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      items: nextItems,
      totals: calculateDraftTotals(nextItems),
    },
  });
});

export const submitDraftToHistoryAtom = atom(null, (get, set) => {
  const state = get(appStateAtom);
  const items = state.todayDraft.items.map((item) => ({
    ...item,
    quantity: clampNonNegative(item.quantity),
  }));

  if (items.length === 0) {
    set(errorAtom, "Draft is empty. Select a plan and edit quantities first.");
    return;
  }

  const totals = calculateDraftTotals(items);
  const price = calculateDraftPrice(items);
  const dateISO = state.todayDraft.draftDateISO || toLocalDateISO(new Date());

  const record: HistoryDayRecord = {
    dateISO,
    submittedAtISO: new Date().toISOString(),
    goalSnapshot: state.goal,
    items,
    totals,
    priceLowerBound: price.priceLowerBound,
    hasUnknownPrice: price.hasUnknownPrice,
    source: "planner-submit",
  };

  const nextByDate = {
    ...state.history.byDate,
    [dateISO]: record,
  };

  set(appStateAtom, {
    ...state,
    history: {
      byDate: nextByDate,
    },
    ui: {
      ...state.ui,
      selectedHistoryDateISO: dateISO,
    },
    todayDraft: {
      ...state.todayDraft,
      items,
      totals,
    },
  });

  const allZero = items.every((item) => item.quantity === 0);
  set(errorAtom, null);
  set(
    noticeAtom,
    allZero
      ? "Saved to history. Warning: all quantities are zero."
      : `Saved ${dateISO} to history.`
  );
});

export const historyWindowRangeAtom = atom((get) => {
  const startISO = get(appStateAtom).ui.historyWindowStartISO;
  const endISO = shiftLocalDateISO(startISO, 29);
  return { startISO, endISO };
});

export const historyDaysInWindowAtom = atom((get) => {
  const state = get(appStateAtom);
  const { startISO, endISO } = get(historyWindowRangeAtom);

  return Object.entries(state.history.byDate)
    .filter(([dateISO]) => dateISO >= startISO && dateISO <= endISO)
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([dateISO, record]) => ({ dateISO, record }));
});

export const historyDayByDateAtom = (dateISO: LocalDateISO) =>
  atom((get) => get(appStateAtom).history.byDate[dateISO] ?? null);

export const historyAggregatesInWindowAtom = atom((get) => {
  return get(historyDaysInWindowAtom).reduce(
    (acc, entry) => {
      acc.carbs += entry.record.totals.carbs;
      acc.fat += entry.record.totals.fat;
      acc.protein += entry.record.totals.protein;
      acc.calories += entry.record.totals.calories ?? 0;
      acc.days += 1;
      return acc;
    },
    {
      carbs: 0,
      fat: 0,
      protein: 0,
      calories: 0,
      days: 0,
    }
  );
});

export const draftPriceSummaryAtom = atom((get) => {
  const items = get(appStateAtom).todayDraft.items;
  return calculateDraftPrice(items);
});

export const updateFoodAtom = atom(
  null,
  (get, set, payload: { foodId: string; updates: Partial<Food> }) => {
    const state = get(appStateAtom);
    const hasExplicitIconUpdate = Object.prototype.hasOwnProperty.call(
      payload.updates,
      "icon"
    );
    set(appStateAtom, {
      ...state,
      foods: state.foods.map((food) => {
        if (food.id !== payload.foodId) {
          return food;
        }

        const merged: Food = { ...food, ...payload.updates };
        const nameChanged =
          typeof payload.updates.name === "string" && payload.updates.name !== food.name;
        const iconMissing = !merged.icon || merged.icon.trim() === "";

        if (nameChanged && !hasExplicitIconUpdate && iconMissing) {
          const inferred = inferFoodIconFromName(merged.name);
          if (inferred) {
            merged.icon = inferred;
          }
        }

        return merged;
      }),
    });
  }
);

export const updateNutritionAtom = atom(
  null,
  (
    get,
    set,
    payload: { foodId: string; updates: Partial<Food["nutritionPerUnit"]> }
  ) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      foods: state.foods.map((food) =>
        food.id === payload.foodId
          ? {
              ...food,
              nutritionPerUnit: { ...food.nutritionPerUnit, ...payload.updates },
            }
          : food
      ),
    });
  }
);

export const updateStockAtom = atom(
  null,
  (get, set, payload: { foodId: string; stock: PantryItem["stock"] }) => {
    const state = get(appStateAtom);
    const existing = state.pantry.find((item) => item.foodId === payload.foodId);
    if (existing) {
      set(appStateAtom, {
        ...state,
        pantry: state.pantry.map((item) =>
          item.foodId === payload.foodId ? { ...item, stock: payload.stock } : item
        ),
      });
      return;
    }

    set(appStateAtom, {
      ...state,
      pantry: [...state.pantry, { foodId: payload.foodId, stock: payload.stock }],
    });
  }
);

export const addFoodAtom = atom(null, (get, set) => {
  const state = get(appStateAtom);
  const id = newFoodId();
  set(appStateAtom, {
    ...state,
    foods: [
      ...state.foods,
      {
        id,
        name: "New Food",
        unit: "serving",
        nutritionPerUnit: { carbs: 0, fat: 0, protein: 0 },
      },
    ],
    pantry: [...state.pantry, { foodId: id, stock: 1 }],
  });
});

export const addFoodFromEditorAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      name: string;
      icon?: string;
      unit: string;
      carbs: number;
      fat: number;
      protein: number;
      price?: number;
      stock: PantryItem["stock"];
    }
  ) => {
    const name = payload.name.trim();
    if (!name) {
      return;
    }

    const state = get(appStateAtom);
    const id = newFoodId();
    const inferredIcon = inferFoodIconFromName(name);
    const icon = payload.icon?.trim() ? payload.icon.trim() : inferredIcon;
    const unit = payload.unit.trim() || "serving";
    const stock =
      payload.stock === "inf"
        ? "inf"
        : Number.isFinite(payload.stock)
          ? Math.max(0, payload.stock)
          : 0;

    set(appStateAtom, {
      ...state,
      foods: [
        ...state.foods,
        {
          id,
          name,
          icon,
          unit,
          nutritionPerUnit: {
            carbs: Number.isFinite(payload.carbs) ? payload.carbs : 0,
            fat: Number.isFinite(payload.fat) ? payload.fat : 0,
            protein: Number.isFinite(payload.protein) ? payload.protein : 0,
          },
          price: payload.price,
        },
      ],
      pantry: [...state.pantry, { foodId: id, stock }],
    });
  }
);

export const removeFoodAtom = atom(null, (get, set, foodId: string) => {
  const state = get(appStateAtom);
  set(appStateAtom, {
    ...state,
    foods: state.foods.filter((food) => food.id !== foodId),
    pantry: state.pantry.filter((item) => item.foodId !== foodId),
    constraints: {
      avoidFoodIds: state.constraints.avoidFoodIds?.filter((id) => id !== foodId),
      preferFoodIds: state.constraints.preferFoodIds?.filter((id) => id !== foodId),
    },
  });
});

export const removeFoodsAtom = atom(null, (get, set, foodIds: string[]) => {
  const ids = new Set(foodIds);
  if (ids.size === 0) {
    return;
  }

  const state = get(appStateAtom);
  set(appStateAtom, {
    ...state,
    foods: state.foods.filter((food) => !ids.has(food.id)),
    pantry: state.pantry.filter((item) => !ids.has(item.foodId)),
    constraints: {
      avoidFoodIds: state.constraints.avoidFoodIds?.filter((id) => !ids.has(id)),
      preferFoodIds: state.constraints.preferFoodIds?.filter((id) => !ids.has(id)),
    },
  });
});

export const moveFoodsToTopAtom = atom(null, (get, set, foodIds: string[]) => {
  const ids = new Set(foodIds);
  if (ids.size === 0) {
    return;
  }

  const state = get(appStateAtom);
  const selected = state.foods.filter((food) => ids.has(food.id));
  if (selected.length === 0) {
    return;
  }
  const unselected = state.foods.filter((food) => !ids.has(food.id));

  set(appStateAtom, {
    ...state,
    foods: [...selected, ...unselected],
  });
});

export const updateGoalAtom = atom(
  null,
  (
    get,
    set,
    payload: { key: keyof Goal; field: "min" | "max"; value: number }
  ) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      goal: {
        ...state.goal,
        [payload.key]: {
          ...state.goal[payload.key],
          [payload.field]: payload.value,
        },
      },
    });
  }
);

export const toggleConstraintAtom = atom(
  null,
  (
    get,
    set,
    payload: { type: "avoidFoodIds" | "preferFoodIds"; foodId: string }
  ) => {
    const state = get(appStateAtom);
    const list = new Set(state.constraints[payload.type] ?? []);
    if (list.has(payload.foodId)) {
      list.delete(payload.foodId);
    } else {
      list.add(payload.foodId);
    }

    set(appStateAtom, {
      ...state,
      constraints: { ...state.constraints, [payload.type]: Array.from(list) },
    });
  }
);

export const clearMessagesAtom = atom(null, (_get, set) => {
  set(errorAtom, null);
  set(noticeAtom, null);
});

export const setErrorAtom = atom(null, (_get, set, message: string | null) => {
  set(errorAtom, message);
});

export const setNoticeAtom = atom(null, (_get, set, message: string | null) => {
  set(noticeAtom, message);
});

export const setPlanOptionsAtom = atom(null, (_get, set, options: PlanOption[]) => {
  set(planOptionsAtom, options);
});

export const setSolvingAtom = atom(null, (_get, set, value: boolean) => {
  set(solvingAtom, value);
});

export const setDriveConnectedAtom = atom(null, (_get, set, value: boolean) => {
  set(driveConnectedAtom, value);
});

export const setDriveBusyAtom = atom(null, (_get, set, value: boolean) => {
  set(driveBusyAtom, value);
});

export const getPantryByFoodAtom = atom((get) => {
  const pantry = get(appStateAtom).pantry;
  const map = new Map<string, PantryItem>();
  pantry.forEach((item) => map.set(item.foodId, item));
  return map;
});

export const getConstraintsForFoodAtom = atom((get) => {
  const constraints = get(appStateAtom).constraints;
  return (foodId: string) => ({
    prefer: constraints.preferFoodIds?.includes(foodId) ?? false,
    avoid: constraints.avoidFoodIds?.includes(foodId) ?? false,
  });
});

export const generatePlanOptionsAtom = atom(null, async (get, set) => {
  set(solvingAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);

  try {
    if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
      throw new Error(
        "SharedArrayBuffer is unavailable. Reload after service worker registration or ensure COOP/COEP headers."
      );
    }

    const state = get(appStateAtom);
    const result = await solvePlanOptions(
      {
        foods: state.foods,
        pantry: state.pantry,
        goal: state.goal,
        constraints: state.constraints,
      },
      3
    );

    set(planOptionsAtom, result);
    if (result.length === 0) {
      set(
        errorAtom,
        "No feasible plan found for the current goals and pantry. Try widening ranges or adding stock."
      );
    }
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Solver failed.");
  } finally {
    set(solvingAtom, false);
  }
});

export const solvePlanAtom = generatePlanOptionsAtom;

export const exportToFileAtom = atom(null, (get) => {
  const content = serializeExport(get(appStateAtom));
  downloadTextFile(EXPORT_FILENAME, content);
});

export const copyToClipboardAtom = atom(null, async (get, set) => {
  try {
    const content = serializeExport(get(appStateAtom));
    await navigator.clipboard.writeText(content);
    set(errorAtom, null);
    set(noticeAtom, "Export copied to clipboard.");
  } catch {
    set(errorAtom, "Clipboard write failed. Use Export File instead.");
    set(noticeAtom, null);
  }
});

export const importFromTextAtom = atom(null, (_get, set, text: string) => {
  const imported = parseImportText<AppState>(text, isAppState);
  set(appStateAtom, normalizeAppState(imported));
  set(planOptionsAtom, []);
  set(errorAtom, null);
  set(noticeAtom, "Import completed.");
});

export const importFromFileAtom = atom(null, async (_get, set, file: File) => {
  const text = await file.text();
  set(importFromTextAtom, text);
});

export const pasteFromClipboardAtom = atom(null, async (_get, set) => {
  try {
    const text = await navigator.clipboard.readText();
    set(importFromTextAtom, text);
  } catch {
    set(errorAtom, "Clipboard read failed. Use Import File instead.");
    set(noticeAtom, null);
  }
});

export const connectDriveAtom = atom(null, async (_get, set) => {
  logDrive("connect:start");
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    const status = await connectGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    logDrive("connect:googleStatus", status);
    if (status === "connected") {
      set(driveConnectedAtom, true);
      logDrive("connect:setConnectedTrue");
      set(noticeAtom, "Connected to Google Drive.");
    } else {
      set(noticeAtom, "Redirecting to Google sign-in...");
    }
  } catch (err) {
    logDrive("connect:error", err);
    set(errorAtom, err instanceof Error ? err.message : "Google Drive connect failed.");
  } finally {
    logDrive("connect:done");
    set(driveBusyAtom, false);
  }
});

export const disconnectDriveAtom = atom(null, (_get, set) => {
  logDrive("disconnect:start");
  disconnectGoogleDrive();
  set(driveConnectedAtom, false);
  set(noticeAtom, "Disconnected from Google Drive.");
  logDrive("disconnect:done");
});

export const saveToDriveAtom = atom(null, async (get, set) => {
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    await saveToGoogleDrive(
      DEFAULT_DRIVE_CLIENT_ID,
      serializeExport(get(appStateAtom))
    );
    set(noticeAtom, "Saved to Google Drive.");
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Google Drive save failed.");
  } finally {
    set(driveBusyAtom, false);
  }
});

export const loadFromDriveAtom = atom(null, async (_get, set) => {
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    const content = await loadFromGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    set(importFromTextAtom, content);
    set(noticeAtom, "Loaded from Google Drive.");
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Google Drive load failed.");
  } finally {
    set(driveBusyAtom, false);
  }
});

export type { AppState, PlanConstraints };

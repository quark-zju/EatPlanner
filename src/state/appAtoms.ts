import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { solvePlanOptions } from "../core";
import type { Food, Goal, PantryItem, PlanConstraints, PlanOption } from "../core";
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
  defaultAppState,
  isAppState,
  newFoodId,
  normalizeAppState,
  type AppState,
} from "./appState";

const DEFAULT_DRIVE_CLIENT_ID =
  "775455628972-haf8lsiavs1u6ncpui8f20ac0orkh4nf.apps.googleusercontent.com";
const EXPORT_FILENAME = "eat-planner-export.json";

export const appStateAtom = atomWithStorage<AppState>(
  APP_STATE_STORAGE_KEY,
  defaultAppState,
  undefined,
  { getOnInit: true }
);

export const planOptionsAtom = atom<PlanOption[]>([]);
export const solvingAtom = atom(false);
export const errorAtom = atom<string | null>(null);
export const noticeAtom = atom<string | null>(null);
export const driveConnectedAtom = atom(isGoogleDriveConnected());
export const driveBusyAtom = atom(false);

export const setImportedStateAtom = atom(null, (_get, set, imported: AppState) => {
  set(appStateAtom, normalizeAppState(imported));
  set(planOptionsAtom, []);
  set(errorAtom, null);
  set(noticeAtom, "Import completed.");
});

export const updateFoodAtom = atom(
  null,
  (get, set, payload: { foodId: string; updates: Partial<Food> }) => {
    const state = get(appStateAtom);
    set(appStateAtom, {
      ...state,
      foods: state.foods.map((food) =>
        food.id === payload.foodId ? { ...food, ...payload.updates } : food
      ),
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

export const solvePlanAtom = atom(null, async (get, set) => {
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
  set(driveBusyAtom, true);
  set(errorAtom, null);
  set(noticeAtom, null);
  try {
    await connectGoogleDrive(DEFAULT_DRIVE_CLIENT_ID);
    set(driveConnectedAtom, true);
    set(noticeAtom, "Connected to Google Drive.");
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : "Google Drive connect failed.");
  } finally {
    set(driveBusyAtom, false);
  }
});

export const disconnectDriveAtom = atom(null, (_get, set) => {
  disconnectGoogleDrive();
  set(driveConnectedAtom, false);
  set(noticeAtom, "Disconnected from Google Drive.");
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

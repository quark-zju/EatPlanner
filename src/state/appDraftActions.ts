import { getDefaultStore } from "jotai";
import type { PlanOption } from "../core";
import {
  toLocalDateISO,
  type AppState,
  type DraftItem,
  type HistoryDayRecord,
  type LocalDateISO,
} from "./appState";
import {
  appStateAtom,
  errorAtom,
  noticeAtom,
  plannerContextItemsAtom,
  planOptionsAtom,
  selectedHistoryDateAtom,
} from "./appAtoms";
import { calculateDraftPrice, calculateDraftTotals, clampNonNegative } from "./appDraftMath";

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

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

const mergeDraftItems = (base: DraftItem[], extra: DraftItem[]): DraftItem[] => {
  const merged = new Map<string, DraftItem>();

  for (const item of base) {
    merged.set(item.foodId, { ...item, quantity: clampNonNegative(item.quantity) });
  }

  for (const item of extra) {
    const existing = merged.get(item.foodId);
    if (!existing) {
      merged.set(item.foodId, { ...item, quantity: clampNonNegative(item.quantity) });
      continue;
    }
    merged.set(item.foodId, {
      ...existing,
      ...item,
      quantity: clampNonNegative(existing.quantity) + clampNonNegative(item.quantity),
    });
  }

  return Array.from(merged.values());
};

export const setDraftDate = (dateISO: LocalDateISO, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const historyRecord = state.history.byDate[dateISO];
  if (historyRecord) {
    const items = historyRecord.items.map((item) => ({ ...item }));
    s.set(appStateAtom, {
      ...state,
      todayDraft: {
        ...state.todayDraft,
        draftDateISO: dateISO,
        items,
        totals: calculateDraftTotals(items),
      },
    });
    s.set(errorAtom, null);
    s.set(noticeAtom, `Loaded saved foods for ${dateISO}.`);
    return;
  }

  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      draftDateISO: dateISO,
    },
  });
};

export const selectPlanOptionToDraft = (
  payload: { optionIndex: number; dateISO?: LocalDateISO },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const options = s.get(planOptionsAtom);
  const contextItems = s.get(plannerContextItemsAtom);
  const option = options[payload.optionIndex];
  if (!option) {
    s.set(errorAtom, "Selected plan option was not found.");
    return;
  }

  const optionItems = toDraftItemsFromOption(state, option);
  const items = mergeDraftItems(contextItems, optionItems);
  if (items.length === 0 && contextItems.length === 0) {
    s.set(errorAtom, "Selected plan has no items.");
    return;
  }

  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      selectedOptionId: `${Date.now()}-${payload.optionIndex}`,
      draftDateISO: payload.dateISO ?? state.todayDraft.draftDateISO,
      items,
      totals: calculateDraftTotals(items),
    },
  });
  s.set(errorAtom, null);
  s.set(noticeAtom, 'Plan loaded into "What did you eat?".');
};

export const updateDraftQuantity = (
  payload: { foodId: string; quantity: number },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const nextItems = state.todayDraft.items.map((item) =>
    item.foodId === payload.foodId
      ? { ...item, quantity: clampNonNegative(payload.quantity) }
      : item
  );

  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      items: nextItems,
      totals: calculateDraftTotals(nextItems),
    },
  });
};

export const addDraftFoodFromPantry = (foodId: string, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) {
    s.set(errorAtom, "Selected pantry food was not found.");
    return;
  }

  const existing = state.todayDraft.items.find((item) => item.foodId === foodId);
  const nextItems = existing
    ? state.todayDraft.items.map((item) =>
        item.foodId === foodId ? { ...item, quantity: item.quantity + 1 } : item
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

  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      items: nextItems,
      totals: calculateDraftTotals(nextItems),
    },
  });
  s.set(errorAtom, null);
};

export const removeDraftItem = (foodId: string, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const nextItems = state.todayDraft.items.filter((item) => item.foodId !== foodId);
  s.set(appStateAtom, {
    ...state,
    todayDraft: {
      ...state.todayDraft,
      items: nextItems,
      totals: calculateDraftTotals(nextItems),
    },
  });
};

export const submitDraftToHistory = (store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const items = state.todayDraft.items.map((item) => ({
    ...item,
    quantity: clampNonNegative(item.quantity),
  }));

  if (items.length === 0) {
    s.set(errorAtom, "Draft is empty. Select a plan and edit quantities first.");
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

  const existingRecord = state.history.byDate[dateISO];

  // Best-effort inventory deduction only for newly created day records.
  // Re-saves for the same date replace the history record but do not deduct again.
  let nextPantry = state.pantry;
  let deductedCount = 0;
  let skippedCount = 0;
  if (!existingRecord) {
    const stockByFood = new Map(state.pantry.map((item) => [item.foodId, item.stock]));
    for (const item of items) {
      const required = Math.ceil(clampNonNegative(item.quantity));
      if (required <= 0) {
        continue;
      }

      const currentStock = stockByFood.get(item.foodId);
      if (currentStock === undefined) {
        skippedCount += 1;
        continue;
      }
      if (currentStock === "inf") {
        continue;
      }

      const nextStock = Math.max(0, currentStock - required);
      stockByFood.set(item.foodId, nextStock);
      deductedCount += 1;
    }

    nextPantry = state.pantry.map((entry) => {
      const nextStock = stockByFood.get(entry.foodId);
      return nextStock === undefined ? entry : { ...entry, stock: nextStock };
    });
  }

  s.set(appStateAtom, {
    ...state,
    pantry: nextPantry,
    history: {
      byDate: {
        ...state.history.byDate,
        [dateISO]: record,
      },
    },
    todayDraft: {
      ...state.todayDraft,
      items,
      totals,
    },
  });
  s.set(selectedHistoryDateAtom, dateISO);

  const allZero = items.every((item) => item.quantity === 0);
  s.set(errorAtom, null);
  if (allZero) {
    s.set(noticeAtom, "Saved to history. Warning: all quantities are zero.");
    return;
  }

  if (existingRecord) {
    s.set(noticeAtom, `Saved ${dateISO} to history (replaced existing day).`);
    return;
  }

  if (skippedCount > 0) {
    s.set(
      noticeAtom,
      `Saved ${dateISO} to history. Inventory updated for ${deductedCount} items, skipped ${skippedCount}.`
    );
    return;
  }

  s.set(noticeAtom, `Saved ${dateISO} to history. Inventory updated.`);
};

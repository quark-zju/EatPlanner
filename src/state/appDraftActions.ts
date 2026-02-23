import { getDefaultStore } from "jotai";
import type { PlanOption } from "../core";
import {
  toLocalDateISO,
  type AppState,
  type DraftItem,
  type HistoryDayRecord,
  type LocalDateISO,
} from "./appState";
import { appStateAtom, errorAtom, noticeAtom, planOptionsAtom } from "./appAtoms";
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
  const option = options[payload.optionIndex];
  if (!option) {
    s.set(errorAtom, "Selected plan option was not found.");
    return;
  }

  const items = toDraftItemsFromOption(state, option);
  if (items.length === 0) {
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
  s.set(noticeAtom, "Plan loaded into draft editor.");
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

  s.set(appStateAtom, {
    ...state,
    history: {
      byDate: {
        ...state.history.byDate,
        [dateISO]: record,
      },
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
  s.set(errorAtom, null);
  s.set(
    noticeAtom,
    allZero
      ? "Saved to history. Warning: all quantities are zero."
      : `Saved ${dateISO} to history.`
  );
};

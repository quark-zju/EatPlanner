import { getDefaultStore } from "jotai";
import type { PantryItem } from "../core";
import { solvePlanOptions } from "../core";
import type { AppState, DraftItem } from "./appState";
import {
  appStateAtom,
  errorAtom,
  noticeAtom,
  plannerContextItemsAtom,
  plannerMessageAtom,
  planOptionsAtom,
  solvingAtom,
} from "./appAtoms";
import { clampNonNegative, toRemainingGoal } from "./appDraftMath";

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

const toRemainingPantry = (pantry: PantryItem[], draftItems: DraftItem[]): PantryItem[] => {
  const consumedByFood = new Map<string, number>();
  for (const item of draftItems) {
    const qty = Math.ceil(clampNonNegative(item.quantity));
    if (qty <= 0) {
      continue;
    }
    consumedByFood.set(item.foodId, (consumedByFood.get(item.foodId) ?? 0) + qty);
  }

  return pantry.map((entry) => {
    if (entry.stock === "inf") {
      return entry;
    }
    const consumed = consumedByFood.get(entry.foodId) ?? 0;
    if (consumed <= 0) {
      return entry;
    }
    return { ...entry, stock: Math.max(0, entry.stock - consumed) };
  });
};

export const getRemainingPlanContext = (state: AppState) => {
  return {
    goal: toRemainingGoal(state.goal, state.todayDraft.items),
    pantry: toRemainingPantry(state.pantry, state.todayDraft.items),
  };
};

export const generatePlanOptions = async (
  params?: { localAvoidFoodIds?: string[] },
  store?: StoreLike
) => {
  const s = withStore(store);
  s.set(solvingAtom, true);
  s.set(errorAtom, null);
  s.set(noticeAtom, null);
  s.set(plannerMessageAtom, null);

  try {
    const state = s.get(appStateAtom);
    const contextItems = state.todayDraft.items
      .filter((item) => item.quantity > 0)
      .map((item) => ({ ...item }));
    s.set(plannerContextItemsAtom, contextItems);
    const localAvoid = Array.from(new Set(params?.localAvoidFoodIds ?? []));
    const remaining = getRemainingPlanContext(state);
    const result = await solvePlanOptions(
      {
        foods: state.foods,
        pantry: remaining.pantry,
        goal: remaining.goal,
        constraints: {
          avoidFoodIds: localAvoid,
        },
      },
      state.planOptionLimit
    );

    s.set(planOptionsAtom, result);
    if (result.length === 0) {
      s.set(
        plannerMessageAtom,
        "No feasible plan found for the remaining goals and pantry stock. Try widening ranges or adding stock."
      );
    }
  } catch (err) {
    s.set(errorAtom, err instanceof Error ? err.message : "Solver failed.");
  } finally {
    s.set(solvingAtom, false);
  }
};

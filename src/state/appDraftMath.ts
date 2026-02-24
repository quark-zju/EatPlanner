import type { Goal, Nutrition } from "../core";
import type { DraftItem } from "./appState";

const emptyNutrition = (): Nutrition => ({
  carbs: 0,
  fat: 0,
  protein: 0,
  calories: 0,
});

export const clampNonNegative = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
};

export const calculateDraftTotals = (items: DraftItem[]): Nutrition => {
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

export const toRemainingGoal = (goal: Goal, draftItems: DraftItem[]): Goal => {
  const eaten = calculateDraftTotals(draftItems);
  const remaining = {
    carbs: {
      min: Math.max(0, goal.carbs.min - eaten.carbs),
      max: Math.max(0, goal.carbs.max - eaten.carbs),
    },
    fat: {
      min: Math.max(0, goal.fat.min - eaten.fat),
      max: Math.max(0, goal.fat.max - eaten.fat),
    },
    protein: {
      min: Math.max(0, goal.protein.min - eaten.protein),
      max: Math.max(0, goal.protein.max - eaten.protein),
    },
  } as Goal;

  if (goal.calories) {
    remaining.calories = {
      min: Math.max(0, goal.calories.min - (eaten.calories ?? 0)),
      max: Math.max(0, goal.calories.max - (eaten.calories ?? 0)),
    };
  }

  return remaining;
};

export const calculateDraftPrice = (items: DraftItem[]) => {
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

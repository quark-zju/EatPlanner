import type { Nutrition } from "../core";
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

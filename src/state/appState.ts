import type { Food, Goal, PantryItem, PlanConstraints } from "../core";
import { Map, fromJS } from "immutable";

export type AppState = {
  foods: Food[];
  pantry: PantryItem[];
  goal: Goal;
  constraints: PlanConstraints;
};

export const APP_STATE_STORAGE_KEY = "eat-planner-state-v1";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isMacroRange = (value: unknown): value is { min: number; max: number } => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const range = value as { min?: unknown; max?: unknown };
  return isNumber(range.min) && isNumber(range.max);
};

const isNutrition = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const nutrition = value as {
    carbs?: unknown;
    fat?: unknown;
    protein?: unknown;
    calories?: unknown;
  };
  const caloriesOk =
    nutrition.calories === undefined || isNumber(nutrition.calories);
  return (
    isNumber(nutrition.carbs) &&
    isNumber(nutrition.fat) &&
    isNumber(nutrition.protein) &&
    caloriesOk
  );
};

export const isAppState = (value: unknown): value is AppState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as {
    foods?: unknown;
    pantry?: unknown;
    goal?: unknown;
    constraints?: unknown;
  };

  if (!Array.isArray(obj.foods) || !Array.isArray(obj.pantry)) {
    return false;
  }

  const foodsOk = obj.foods.every((food) => {
    if (!food || typeof food !== "object") {
      return false;
    }
    const f = food as {
      id?: unknown;
      name?: unknown;
      unit?: unknown;
      nutritionPerUnit?: unknown;
      price?: unknown;
    };
    const priceOk = f.price === undefined || isNumber(f.price);
    return (
      typeof f.id === "string" &&
      typeof f.name === "string" &&
      typeof f.unit === "string" &&
      isNutrition(f.nutritionPerUnit) &&
      priceOk
    );
  });

  const pantryOk = obj.pantry.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const p = entry as { foodId?: unknown; stock?: unknown };
    return typeof p.foodId === "string" && (p.stock === "inf" || isNumber(p.stock));
  });

  if (!foodsOk || !pantryOk || !obj.goal || typeof obj.goal !== "object") {
    return false;
  }

  const goal = obj.goal as {
    carbs?: unknown;
    fat?: unknown;
    protein?: unknown;
  };

  const goalOk =
    isMacroRange(goal.carbs) && isMacroRange(goal.fat) && isMacroRange(goal.protein);

  const constraints = obj.constraints;
  const constraintsOk =
    constraints === undefined ||
    (typeof constraints === "object" &&
      constraints !== null &&
      ((constraints as { avoidFoodIds?: unknown }).avoidFoodIds === undefined ||
        (Array.isArray((constraints as { avoidFoodIds?: unknown }).avoidFoodIds) &&
          (constraints as { avoidFoodIds: unknown[] }).avoidFoodIds.every(
            (v) => typeof v === "string"
          ))) &&
      ((constraints as { preferFoodIds?: unknown }).preferFoodIds === undefined ||
        (Array.isArray((constraints as { preferFoodIds?: unknown }).preferFoodIds) &&
          (constraints as { preferFoodIds: unknown[] }).preferFoodIds.every(
            (v) => typeof v === "string"
          ))));

  return goalOk && constraintsOk;
};

export const defaultAppState: AppState = {
  foods: [
    {
      id: "rice",
      name: "Rice",
      unit: "serving",
      nutritionPerUnit: { carbs: 45, fat: 0.4, protein: 4 },
      price: 1.2,
    },
    {
      id: "chicken",
      name: "Chicken",
      unit: "serving",
      nutritionPerUnit: { carbs: 0, fat: 3, protein: 31 },
      price: 2.5,
    },
    {
      id: "olive-oil",
      name: "Olive Oil",
      unit: "tbsp",
      nutritionPerUnit: { carbs: 0, fat: 14, protein: 0 },
    },
  ],
  pantry: [
    { foodId: "rice", stock: 3 },
    { foodId: "chicken", stock: 3 },
    { foodId: "olive-oil", stock: 2 },
  ],
  goal: {
    carbs: { min: 90, max: 120 },
    fat: { min: 10, max: 22 },
    protein: { min: 60, max: 90 },
  },
  constraints: {
    avoidFoodIds: [],
    preferFoodIds: [],
  },
};

export const normalizeAppState = (state: AppState): AppState => ({
  ...defaultAppState,
  ...state,
  constraints: {
    avoidFoodIds: state.constraints?.avoidFoodIds ?? [],
    preferFoodIds: state.constraints?.preferFoodIds ?? [],
  },
});

export type AppStateMap = Map<string, unknown>;

export const toAppStateMap = (state: AppState): AppStateMap =>
  fromJS(normalizeAppState(state)) as AppStateMap;

export const fromAppStateMap = (map: AppStateMap): AppState =>
  normalizeAppState(map.toJS() as AppState);

export const defaultAppStateMap = toAppStateMap(defaultAppState);

export const newFoodId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `food-${Date.now()}`;

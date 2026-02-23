import { getDefaultStore } from "jotai";
import type { Food, PantryItem } from "../core";
import { newFoodId } from "./appState";
import { inferFoodIconFromName } from "./foodIcons";
import { appStateAtom } from "./appAtoms";

type StoreLike = ReturnType<typeof getDefaultStore>;

const defaultStore = getDefaultStore();
const withStore = (store?: StoreLike) => store ?? defaultStore;

export const updateFood = (
  payload: { foodId: string; updates: Partial<Food> },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const hasExplicitIconUpdate = Object.prototype.hasOwnProperty.call(payload.updates, "icon");
  s.set(appStateAtom, {
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
};

export const updateNutrition = (
  payload: { foodId: string; updates: Partial<Food["nutritionPerUnit"]> },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
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
};

export const updateStock = (
  payload: { foodId: string; stock: PantryItem["stock"] },
  store?: StoreLike
) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const existing = state.pantry.find((item) => item.foodId === payload.foodId);
  if (existing) {
    s.set(appStateAtom, {
      ...state,
      pantry: state.pantry.map((item) =>
        item.foodId === payload.foodId ? { ...item, stock: payload.stock } : item
      ),
    });
    return;
  }

  s.set(appStateAtom, {
    ...state,
    pantry: [...state.pantry, { foodId: payload.foodId, stock: payload.stock }],
  });
};

export const addFood = (store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  const id = newFoodId();
  s.set(appStateAtom, {
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
};

export const addFoodFromEditor = (
  payload: {
    name: string;
    icon?: string;
    unit: string;
    carbs: number;
    fat: number;
    protein: number;
    price?: number;
    stock: PantryItem["stock"];
  },
  store?: StoreLike
) => {
  const name = payload.name.trim();
  if (!name) {
    return;
  }

  const s = withStore(store);
  const state = s.get(appStateAtom);
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

  s.set(appStateAtom, {
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
};

export const removeFood = (foodId: string, store?: StoreLike) => {
  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
    ...state,
    foods: state.foods.filter((food) => food.id !== foodId),
    pantry: state.pantry.filter((item) => item.foodId !== foodId),
  });
};

export const removeFoods = (foodIds: string[], store?: StoreLike) => {
  const ids = new Set(foodIds);
  if (ids.size === 0) {
    return;
  }

  const s = withStore(store);
  const state = s.get(appStateAtom);
  s.set(appStateAtom, {
    ...state,
    foods: state.foods.filter((food) => !ids.has(food.id)),
    pantry: state.pantry.filter((item) => !ids.has(item.foodId)),
  });
};

export const moveFoodsToTop = (foodIds: string[], store?: StoreLike) => {
  const ids = new Set(foodIds);
  if (ids.size === 0) {
    return;
  }

  const s = withStore(store);
  const state = s.get(appStateAtom);
  const selected = state.foods.filter((food) => ids.has(food.id));
  if (selected.length === 0) {
    return;
  }
  const unselected = state.foods.filter((food) => !ids.has(food.id));

  s.set(appStateAtom, {
    ...state,
    foods: [...selected, ...unselected],
  });
};

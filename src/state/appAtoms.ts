import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Food, Goal, PantryItem, PlanConstraints, PlanOption } from "../core";
import { isGoogleDriveConnected } from "../storage/googleDrive";
import {
  APP_STATE_STORAGE_KEY,
  defaultAppState,
  newFoodId,
  normalizeAppState,
  type AppState,
} from "./appState";

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

export type { AppState, PlanConstraints };

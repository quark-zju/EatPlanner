import { Map, fromJS } from "immutable";
import type {
  Food,
  Goal,
  Nutrition,
  PantryItem,
} from "../core";

export type UiTab = "today" | "history" | "inventory" | "settings";
export type LocalDateISO = string;
export const DEFAULT_FOOD_ICON = "🍽️";

export type DraftItem = {
  foodId: string;
  foodNameSnapshot: string;
  foodIconSnapshot?: string;
  unitSnapshot: string;
  nutritionPerUnitSnapshot: Nutrition;
  quantity: number;
  pricePerUnitSnapshot?: number;
};

export type HistoryDayRecord = {
  dateISO: LocalDateISO;
  submittedAtISO: string;
  goalSnapshot: Goal;
  items: DraftItem[];
  totals: Nutrition;
  priceLowerBound: number;
  hasUnknownPrice: boolean;
  source: "planner-submit";
};

export type TodayDraftState = {
  selectedOptionId?: string;
  draftDateISO: LocalDateISO;
  items: DraftItem[];
  totals: Nutrition;
};

export type HistoryState = {
  byDate: Record<LocalDateISO, HistoryDayRecord>;
};

export type AppState = {
  foods: Food[];
  pantry: PantryItem[];
  goal: Goal;
  planOptionLimit: number;
  todayDraft: TodayDraftState;
  history: HistoryState;
};

export const APP_STATE_STORAGE_KEY = "eat-planner-state-v1";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clampPlanOptionLimit = (value: number | undefined) =>
  Math.max(1, Math.trunc(value ?? 3));

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

const isDraftItem = (value: unknown): value is DraftItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as {
    foodId?: unknown;
    foodNameSnapshot?: unknown;
    foodIconSnapshot?: unknown;
    unitSnapshot?: unknown;
    nutritionPerUnitSnapshot?: unknown;
    quantity?: unknown;
    pricePerUnitSnapshot?: unknown;
  };
  const priceOk =
    item.pricePerUnitSnapshot === undefined || isNumber(item.pricePerUnitSnapshot);
  const iconOk = item.foodIconSnapshot === undefined || typeof item.foodIconSnapshot === "string";
  return (
    typeof item.foodId === "string" &&
    typeof item.foodNameSnapshot === "string" &&
    iconOk &&
    typeof item.unitSnapshot === "string" &&
    isNutrition(item.nutritionPerUnitSnapshot) &&
    isNumber(item.quantity) &&
    priceOk
  );
};

const isHistoryDayRecord = (value: unknown): value is HistoryDayRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as {
    dateISO?: unknown;
    submittedAtISO?: unknown;
    goalSnapshot?: unknown;
    items?: unknown;
    totals?: unknown;
    priceLowerBound?: unknown;
    hasUnknownPrice?: unknown;
    source?: unknown;
  };

  const goalOk =
    record.goalSnapshot !== undefined &&
    typeof record.goalSnapshot === "object" &&
    isMacroRange((record.goalSnapshot as { carbs?: unknown }).carbs) &&
    isMacroRange((record.goalSnapshot as { fat?: unknown }).fat) &&
    isMacroRange((record.goalSnapshot as { protein?: unknown }).protein);

  return (
    typeof record.dateISO === "string" &&
    typeof record.submittedAtISO === "string" &&
    goalOk &&
    Array.isArray(record.items) &&
    record.items.every(isDraftItem) &&
    isNutrition(record.totals) &&
    isNumber(record.priceLowerBound) &&
    typeof record.hasUnknownPrice === "boolean" &&
    record.source === "planner-submit"
  );
};

const isTodayDraftState = (value: unknown): value is TodayDraftState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as {
    selectedOptionId?: unknown;
    draftDateISO?: unknown;
    items?: unknown;
    totals?: unknown;
  };
  const selectedOk =
    draft.selectedOptionId === undefined || typeof draft.selectedOptionId === "string";

  return (
    selectedOk &&
    typeof draft.draftDateISO === "string" &&
    Array.isArray(draft.items) &&
    draft.items.every(isDraftItem) &&
    isNutrition(draft.totals)
  );
};

const isHistoryState = (value: unknown): value is HistoryState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const history = value as { byDate?: unknown };
  if (!history.byDate || typeof history.byDate !== "object" || Array.isArray(history.byDate)) {
    return false;
  }

  return Object.values(history.byDate as Record<string, unknown>).every(isHistoryDayRecord);
};

export const isAppState = (value: unknown): value is AppState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as {
    foods?: unknown;
    pantry?: unknown;
    goal?: unknown;
    planOptionLimit?: unknown;
    todayDraft?: unknown;
    history?: unknown;
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
      icon?: unknown;
      unit?: unknown;
      nutritionPerUnit?: unknown;
      price?: unknown;
    };
    const priceOk = f.price === undefined || isNumber(f.price);
    const iconOk = f.icon === undefined || typeof f.icon === "string";
    return (
      typeof f.id === "string" &&
      typeof f.name === "string" &&
      iconOk &&
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
  const planOptionLimitOk =
    obj.planOptionLimit === undefined ||
    (isNumber(obj.planOptionLimit) && obj.planOptionLimit >= 1);

  const todayDraftOk = obj.todayDraft === undefined || isTodayDraftState(obj.todayDraft);
  const historyOk = obj.history === undefined || isHistoryState(obj.history);

  return goalOk && planOptionLimitOk && todayDraftOk && historyOk;
};

export const toLocalDateISO = (date: Date): LocalDateISO => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromLocalDateISO = (iso: LocalDateISO) => {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
};

export const shiftLocalDateISO = (iso: LocalDateISO, days: number): LocalDateISO => {
  const next = fromLocalDateISO(iso);
  next.setDate(next.getDate() + days);
  return toLocalDateISO(next);
};

export const getRollingWindowStartISO = (baseDate: Date = new Date()): LocalDateISO => {
  return shiftLocalDateISO(toLocalDateISO(baseDate), -29);
};

const emptyNutrition = (): Nutrition => ({
  carbs: 0,
  fat: 0,
  protein: 0,
  calories: 0,
});

export const defaultAppState: AppState = {
  foods: [
    {
      id: "rice",
      name: "Rice",
      icon: "🍚",
      unit: "serving",
      nutritionPerUnit: { carbs: 45, fat: 0.4, protein: 4 },
      price: 1.2,
    },
    {
      id: "chicken",
      name: "Chicken",
      icon: "🍗",
      unit: "serving",
      nutritionPerUnit: { carbs: 0, fat: 3, protein: 31 },
      price: 2.5,
    },
    {
      id: "olive-oil",
      name: "Olive Oil",
      icon: "🫒",
      unit: "tbsp",
      nutritionPerUnit: { carbs: 0, fat: 14, protein: 0 },
    },
    {
      id: "morningstar-patty",
      name: "MorningStar Patty",
      icon: "🍔",
      unit: "patty",
      nutritionPerUnit: { carbs: 5, fat: 3, protein: 8 },
    },
    {
      id: "riced-veggies",
      name: "Riced Veggies",
      icon: "🥦",
      unit: "85g",
      nutritionPerUnit: { carbs: 7, fat: 2, protein: 2 },
    },
    {
      id: "laoganma-fried-chili",
      name: "Laoganma Fried Chili",
      icon: "🌶️",
      unit: "1/4 cup",
      nutritionPerUnit: { carbs: 17, fat: 32, protein: 4 },
    },
    {
      id: "pineapple",
      name: "Pineapple",
      icon: "🍍",
      unit: "165g",
      nutritionPerUnit: { carbs: 21.6, fat: 0.2, protein: 0.9 },
    },
    {
      id: "readypac-coleslaw",
      name: "ReadyPac Coleslaw",
      icon: "🥗",
      unit: "85g",
      nutritionPerUnit: { carbs: 5, fat: 0, protein: 1 },
    },
  ],
  pantry: [
    { foodId: "rice", stock: 3 },
    { foodId: "chicken", stock: 3 },
    { foodId: "olive-oil", stock: 2 },
    { foodId: "morningstar-patty", stock: 2 },
    { foodId: "riced-veggies", stock: 2 },
    { foodId: "laoganma-fried-chili", stock: 1 },
    { foodId: "pineapple", stock: 1 },
    { foodId: "readypac-coleslaw", stock: 2 },
  ],
  goal: {
    carbs: { min: 90, max: 120 },
    fat: { min: 10, max: 22 },
    protein: { min: 60, max: 90 },
  },
  planOptionLimit: 3,
  todayDraft: {
    selectedOptionId: undefined,
    draftDateISO: toLocalDateISO(new Date()),
    items: [],
    totals: emptyNutrition(),
  },
  history: {
    byDate: {},
  },
};

export const normalizeAppState = (state: AppState): AppState => {
  const stateWithoutUi = state as AppState & { ui?: unknown; constraints?: unknown };
  const { ui: _ui, constraints: _constraints, ...stateData } = stateWithoutUi;
  const merged = {
    ...defaultAppState,
    ...stateData,
    planOptionLimit: clampPlanOptionLimit((stateData as AppState).planOptionLimit),
    todayDraft: {
      ...defaultAppState.todayDraft,
      ...(state.todayDraft ?? {}),
      items: state.todayDraft?.items ?? defaultAppState.todayDraft.items,
      totals: {
        ...emptyNutrition(),
        ...(state.todayDraft?.totals ?? {}),
      },
    },
    history: {
      byDate: state.history?.byDate ?? {},
    },
  };

  return merged;
};

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

export const getFoodIcon = (icon?: string) => {
  const trimmed = icon?.trim();
  return trimmed ? trimmed : DEFAULT_FOOD_ICON;
};

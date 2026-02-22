import type {
  Food,
  Nutrition,
  PantryItem,
  PlanInput,
  PlanOption,
  PlanSolution,
} from "./types";
const DEFAULT_NUTRITION: Nutrition = {
  carbs: 0,
  fat: 0,
  protein: 0,
};

const toNumber = (value: number | undefined) => value ?? 0;

const computeTotals = (
  foods: Food[],
  servings: Record<string, number>
): Nutrition => {
  return foods.reduce<Nutrition>(
    (totals, food) => {
      const count = servings[food.id] ?? 0;
      const nutrition = food.nutritionPerUnit;

      totals.carbs += toNumber(nutrition.carbs) * count;
      totals.fat += toNumber(nutrition.fat) * count;
      totals.protein += toNumber(nutrition.protein) * count;
      totals.calories =
        toNumber(totals.calories) + toNumber(nutrition.calories) * count;

      return totals;
    },
    {
      carbs: 0,
      fat: 0,
      protein: 0,
      calories: 0,
    }
  );
};

const getStockForFood = (pantry: PantryItem[], foodId: string) => {
  const entry = pantry.find((item) => item.foodId === foodId);
  if (!entry) {
    return 0;
  }
  return entry.stock;
};

const withinRange = (value: number, min: number, max: number) =>
  value >= min && value <= max;

const MAX_INF_STOCK = 6;
const MAX_NODES = 50000;

export const solvePlanOptions = async (
  input: PlanInput,
  limit = 3
): Promise<PlanOption[]> => {
  const { foods, pantry, goal, constraints } = input;
  const avoidSet = new Set(constraints?.avoidFoodIds ?? []);

  const maxServings = foods.map((food) => {
    if (avoidSet.has(food.id)) {
      return 0;
    }
    const stock = getStockForFood(pantry, food.id);
    if (stock === "inf") {
      return MAX_INF_STOCK;
    }
    return Math.max(0, Math.floor(stock));
  });

  const macros = ["carbs", "fat", "protein"] as const;
  const minTargets = macros.map((macro) => goal[macro].min);
  const maxTargets = macros.map((macro) => goal[macro].max);

  const solutions: PlanOption[] = [];
  let visited = 0;

  const dfs = (
    index: number,
    servings: number[],
    totals: Nutrition,
    priceLowerBound: number,
    hasUnknownPrice: boolean
  ) => {
    if (visited >= MAX_NODES) {
      return;
    }
    visited += 1;

    const totalsArray = macros.map((macro) => totals[macro]);
    if (totalsArray.some((value, i) => value > maxTargets[i])) {
      return;
    }

    if (index === foods.length) {
      if (
        withinRange(totals.carbs, goal.carbs.min, goal.carbs.max) &&
        withinRange(totals.fat, goal.fat.min, goal.fat.max) &&
        withinRange(totals.protein, goal.protein.min, goal.protein.max)
      ) {
        const servingsMap: Record<string, number> = {};
        foods.forEach((food, i) => {
          servingsMap[food.id] = servings[i];
        });
        solutions.push({
          status: "sat",
          servings: servingsMap,
          totals: { ...totals },
          priceLowerBound,
          hasUnknownPrice,
        });
      }
      return;
    }

    const remainingMax = macros.map((macro) => {
      let sum = 0;
      for (let i = index; i < foods.length; i += 1) {
        const nutrient = foods[i].nutritionPerUnit[macro];
        sum += toNumber(nutrient) * maxServings[i];
      }
      return sum;
    });

    if (
      totalsArray.some((value, i) => value + remainingMax[i] < minTargets[i])
    ) {
      return;
    }

    const food = foods[index];
    const maxCount = maxServings[index];

    for (let count = maxCount; count >= 0; count -= 1) {
      const nextTotals: Nutrition = {
        carbs: totals.carbs + food.nutritionPerUnit.carbs * count,
        fat: totals.fat + food.nutritionPerUnit.fat * count,
        protein: totals.protein + food.nutritionPerUnit.protein * count,
        calories:
          toNumber(totals.calories) +
          toNumber(food.nutritionPerUnit.calories) * count,
      };

      const nextPrice =
        food.price === undefined
          ? priceLowerBound
          : priceLowerBound + food.price * count;
      const nextHasUnknown = hasUnknownPrice ||
        (food.price === undefined && count > 0);

      servings[index] = count;
      dfs(index + 1, servings, nextTotals, nextPrice, nextHasUnknown);
      servings[index] = 0;
    }
  };

  dfs(0, new Array(foods.length).fill(0), { ...DEFAULT_NUTRITION }, 0, false);

  const sorted = solutions.sort((a, b) => {
    if (a.priceLowerBound !== b.priceLowerBound) {
      return a.priceLowerBound - b.priceLowerBound;
    }
    const aServings = Object.values(a.servings).reduce((sum, v) => sum + v, 0);
    const bServings = Object.values(b.servings).reduce((sum, v) => sum + v, 0);
    return aServings - bServings;
  });

  const unique: PlanOption[] = [];
  const seen = new Set<string>();
  for (const option of sorted) {
    const key = JSON.stringify(option.servings);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(option);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
};

export const solvePlan = async (input: PlanInput): Promise<PlanSolution> => {
  const options = await solvePlanOptions(input, 1);
  if (options.length === 0) {
    return {
      status: "unsat",
      servings: {},
      totals: computeTotals(input.foods, {}),
      priceLowerBound: 0,
      hasUnknownPrice: false,
    };
  }
  return options[0];
};

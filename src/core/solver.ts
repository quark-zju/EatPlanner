import { init } from "z3-solver";
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

const parseIntegerValue = (expr: unknown): number => {
  if (typeof expr === "number") {
    return Math.trunc(expr);
  }

  if (expr && typeof expr === "object") {
    const maybeString = (expr as { asString?: () => string }).asString?.();
    if (typeof maybeString === "string") {
      return Number.parseInt(maybeString, 10);
    }

    const maybeValue = (expr as { value?: () => unknown }).value?.();
    if (typeof maybeValue === "bigint") {
      return Number(maybeValue);
    }
    if (typeof maybeValue === "number") {
      return Math.trunc(maybeValue);
    }
  }

  return Number(expr ?? 0);
};

const getStockForFood = (pantry: PantryItem[], foodId: string) => {
  const entry = pantry.find((item) => item.foodId === foodId);
  if (!entry) {
    return 0;
  }
  return entry.stock;
};

export const computeFeasibleBounds = (input: PlanInput) => {
  const { foods, pantry, constraints } = input;
  const avoidSet = new Set(constraints?.avoidFoodIds ?? []);

  return foods.reduce(
    (acc, food) => {
      if (avoidSet.has(food.id)) {
        return acc;
      }
      const stock = getStockForFood(pantry, food.id);
      const maxServings = stock === "inf" ? Infinity : Math.max(0, Math.floor(stock));
      const nutrition = food.nutritionPerUnit;

      acc.min.carbs += 0;
      acc.min.fat += 0;
      acc.min.protein += 0;
      acc.max.carbs = Number.isFinite(acc.max.carbs)
        ? acc.max.carbs + toNumber(nutrition.carbs) * maxServings
        : acc.max.carbs;
      acc.max.fat = Number.isFinite(acc.max.fat)
        ? acc.max.fat + toNumber(nutrition.fat) * maxServings
        : acc.max.fat;
      acc.max.protein = Number.isFinite(acc.max.protein)
        ? acc.max.protein + toNumber(nutrition.protein) * maxServings
        : acc.max.protein;

      acc.min.calories = toNumber(acc.min.calories);
      if (Number.isFinite(acc.max.calories)) {
        acc.max.calories =
          toNumber(acc.max.calories) +
          toNumber(nutrition.calories) * maxServings;
      }

      if (stock === "inf") {
        if (toNumber(nutrition.carbs) > 0) acc.max.carbs = Infinity;
        if (toNumber(nutrition.fat) > 0) acc.max.fat = Infinity;
        if (toNumber(nutrition.protein) > 0) acc.max.protein = Infinity;
        if (toNumber(nutrition.calories) > 0) acc.max.calories = Infinity;
      }

      return acc;
    },
    {
      min: { carbs: 0, fat: 0, protein: 0, calories: 0 },
      max: { carbs: 0, fat: 0, protein: 0, calories: 0 },
    }
  );
};

export const computeTotals = (
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

export const solvePlan = async (input: PlanInput): Promise<PlanSolution> => {
  const options = await solvePlanOptions(input, 1);
  if (options.length === 0) {
    return {
      status: "unsat",
      servings: {},
      totals: { ...DEFAULT_NUTRITION },
      priceLowerBound: 0,
      hasUnknownPrice: false,
    };
  }
  return options[0];
};

export const solvePlanOptions = async (
  input: PlanInput,
  limit = 3
): Promise<PlanOption[]> => {
  if (import.meta.env.DEV) {
    console.log("[solver] starting solvePlanOptions");
  }
  const { foods, pantry, goal, constraints } = input;
  const avoidSet = new Set(constraints?.avoidFoodIds ?? []);
  const preferSet = new Set(constraints?.preferFoodIds ?? []);

  if (import.meta.env.DEV) {
    console.log("[solver] init z3");
  }
  const { Context } = await init();
  const { Optimize, Int, Real, ToReal, Or } = new Context("main");

  const optimizer = new Optimize();
  const servingsVars = new Map<string, ReturnType<typeof Int.const>>();

  const carbsSum = foods.reduce((acc, food) => {
    const variable = Int.const(`servings_${food.id}`);
    servingsVars.set(food.id, variable);

    const stock = getStockForFood(pantry, food.id);
    optimizer.add(variable.ge(0));

    if (stock !== "inf") {
      optimizer.add(variable.le(stock));
    }

    if (avoidSet.has(food.id)) {
      optimizer.add(variable.eq(0));
    }

    if (preferSet.has(food.id)) {
      optimizer.addSoft(variable.gt(0), 1, `prefer_${food.id}`);
    }

    return acc.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.carbs)))
    );
  }, Real.val(0));

  const fatSum = foods.reduce((acc, food) => {
    const variable = servingsVars.get(food.id)!;
    return acc.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.fat)))
    );
  }, Real.val(0));

  const proteinSum = foods.reduce((acc, food) => {
    const variable = servingsVars.get(food.id)!;
    return acc.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.protein)))
    );
  }, Real.val(0));

  optimizer.add(carbsSum.ge(goal.carbs.min));
  optimizer.add(carbsSum.le(goal.carbs.max));
  optimizer.add(fatSum.ge(goal.fat.min));
  optimizer.add(fatSum.le(goal.fat.max));
  optimizer.add(proteinSum.ge(goal.protein.min));
  optimizer.add(proteinSum.le(goal.protein.max));

  if (goal.calories) {
    const caloriesSum = foods.reduce((acc, food) => {
      const variable = servingsVars.get(food.id)!;
      return acc.add(
        ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.calories)))
      );
    }, Real.val(0));

    optimizer.add(caloriesSum.ge(goal.calories.min));
    optimizer.add(caloriesSum.le(goal.calories.max));
  }

  const priceSum = foods.reduce((acc, food) => {
    if (food.price === undefined) {
      return acc;
    }
    const variable = servingsVars.get(food.id)!;
    return acc.add(ToReal(variable).mul(Real.val(toNumber(food.price))));
  }, Real.val(0));

  const totalServings = Array.from(servingsVars.values()).reduce(
    (acc, variable) => acc.add(variable),
    Int.val(0)
  );

  optimizer.minimize(priceSum);
  optimizer.minimize(ToReal(totalServings));

  const options: PlanOption[] = [];
  for (let i = 0; i < limit; i += 1) {
    if (import.meta.env.DEV) {
      console.log("[solver] checking solution", i + 1);
    }
    const status = await optimizer.check();
    if (import.meta.env.DEV) {
      console.log("[solver] status", status);
    }
    if (status !== "sat") {
      break;
    }

    const model = optimizer.model();
    const servings: Record<string, number> = {};
    for (const [foodId, variable] of servingsVars.entries()) {
      const valueExpr = model.eval(variable, true);
      servings[foodId] = parseIntegerValue(valueExpr);
    }

    const totals = computeTotals(foods, servings);
    let priceLowerBound = 0;
    let hasUnknownPrice = false;

    for (const food of foods) {
      const count = servings[food.id] ?? 0;
      if (count <= 0) {
        continue;
      }
      if (food.price === undefined) {
        hasUnknownPrice = true;
      } else {
        priceLowerBound += food.price * count;
      }
    }

    options.push({
      status,
      servings,
      totals,
      priceLowerBound,
      hasUnknownPrice,
    });

    const blocking = Or(
      ...Array.from(servingsVars.entries()).map(([foodId, variable]) =>
        variable.neq(Int.val(servings[foodId]))
      )
    );
    optimizer.add(blocking);
  }

  return options;
};

import { init } from "z3-solver";
import type {
  Food,
  Nutrition,
  PantryItem,
  PlanInput,
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
  const { foods, pantry, goal, constraints } = input;
  const avoidSet = new Set(constraints?.avoidFoodIds ?? []);
  const preferSet = new Set(constraints?.preferFoodIds ?? []);

  const { Context } = await init();
  const { Optimize, Int, Real } = new Context("main");

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

    return acc.add(variable.mul(Real.val(toNumber(food.nutritionPerUnit.carbs))));
  }, Real.val(0));

  const fatSum = foods.reduce((acc, food) => {
    const variable = servingsVars.get(food.id)!;
    return acc.add(variable.mul(Real.val(toNumber(food.nutritionPerUnit.fat))));
  }, Real.val(0));

  const proteinSum = foods.reduce((acc, food) => {
    const variable = servingsVars.get(food.id)!;
    return acc.add(
      variable.mul(Real.val(toNumber(food.nutritionPerUnit.protein)))
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
        variable.mul(Real.val(toNumber(food.nutritionPerUnit.calories)))
      );
    }, Real.val(0));

    optimizer.add(caloriesSum.ge(goal.calories.min));
    optimizer.add(caloriesSum.le(goal.calories.max));
  }

  const totalServings = Array.from(servingsVars.values()).reduce(
    (acc, variable) => acc.add(variable),
    Int.val(0)
  );
  optimizer.minimize(totalServings);

  const status = await optimizer.check();
  if (status !== "sat") {
    return {
      status,
      servings: {},
      totals: { ...DEFAULT_NUTRITION },
    };
  }

  const model = optimizer.model();
  const servings: Record<string, number> = {};
  for (const [foodId, variable] of servingsVars.entries()) {
    const valueExpr = model.eval(variable, true);
    servings[foodId] = parseIntegerValue(valueExpr);
  }

  const totals = computeTotals(foods, servings);

  return {
    status,
    servings,
    totals,
  };
};

import { init } from "z3-solver";
import { shouldLog } from "./debug";
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
  if (shouldLog) {
    console.log("[solver] starting solvePlanOptions");
  }
  const { foods, pantry, goal, constraints } = input;
  const avoidSet = new Set(constraints?.avoidFoodIds ?? []);
  const preferSet = new Set(constraints?.preferFoodIds ?? []);

  if (shouldLog) {
    console.log("[solver] init z3");
  }
  const { Context } = await init();
  const { Optimize, Int, Real, ToReal, Or } = new Context("main");

  const optimizer = new Optimize();
  const servingsVars = new Map<string, ReturnType<typeof Int.const>>();

  let carbsSum: any = Real.val(0);
  for (const food of foods) {
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

    carbsSum = carbsSum.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.carbs)))
    );
  }

  let fatSum: any = Real.val(0);
  for (const food of foods) {
    const variable = servingsVars.get(food.id)!;
    fatSum = fatSum.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.fat)))
    );
  }

  let proteinSum: any = Real.val(0);
  for (const food of foods) {
    const variable = servingsVars.get(food.id)!;
    proteinSum = proteinSum.add(
      ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.protein)))
    );
  }

  optimizer.add(carbsSum.ge(goal.carbs.min));
  optimizer.add(carbsSum.le(goal.carbs.max));
  optimizer.add(fatSum.ge(goal.fat.min));
  optimizer.add(fatSum.le(goal.fat.max));
  optimizer.add(proteinSum.ge(goal.protein.min));
  optimizer.add(proteinSum.le(goal.protein.max));

  if (goal.calories) {
    let caloriesSum: any = Real.val(0);
    for (const food of foods) {
      const variable = servingsVars.get(food.id)!;
      caloriesSum = caloriesSum.add(
        ToReal(variable).mul(Real.val(toNumber(food.nutritionPerUnit.calories)))
      );
    }

    optimizer.add(caloriesSum.ge(goal.calories.min));
    optimizer.add(caloriesSum.le(goal.calories.max));
  }

  let priceSum: any = Real.val(0);
  for (const food of foods) {
    if (food.price === undefined) {
      continue;
    }
    const variable = servingsVars.get(food.id)!;
    priceSum = priceSum.add(ToReal(variable).mul(Real.val(toNumber(food.price))));
  }

  let totalServings: any = Int.val(0);
  for (const variable of servingsVars.values()) {
    totalServings = totalServings.add(variable);
  }

  optimizer.minimize(priceSum);
  optimizer.minimize(ToReal(totalServings));

  const options: PlanOption[] = [];
  for (let i = 0; i < limit; i += 1) {
    if (shouldLog) {
      console.log("[solver] checking solution", i + 1);
    }
    const status = await optimizer.check();
    if (shouldLog) {
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

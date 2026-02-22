export type MacroName = "carbs" | "fat" | "protein";

export type MacroRange = {
  min: number;
  max: number;
};

export type Nutrition = {
  carbs: number;
  fat: number;
  protein: number;
  calories?: number;
};

export type Goal = {
  carbs: MacroRange;
  fat: MacroRange;
  protein: MacroRange;
  calories?: MacroRange;
};

export type Food = {
  id: string;
  name: string;
  unit: string;
  nutritionPerUnit: Nutrition;
  price?: number;
};

export type PantryItem = {
  foodId: string;
  stock: number | "inf";
};

export type PlanConstraints = {
  avoidFoodIds?: string[];
  preferFoodIds?: string[];
};

export type PlanInput = {
  foods: Food[];
  pantry: PantryItem[];
  goal: Goal;
  constraints?: PlanConstraints;
};

export type PlanSolution = {
  status: "sat" | "unsat" | "unknown";
  servings: Record<string, number>;
  totals: Nutrition;
  priceLowerBound: number;
  hasUnknownPrice: boolean;
};

export type NutritionTotals = Nutrition;

export type PlanOption = PlanSolution;

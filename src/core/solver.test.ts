import { describe, expect, it } from "vitest";
import { computeTotals, solvePlan } from "./solver";
import type { Food, PlanInput } from "./types";

const foods: Food[] = [
  {
    id: "rice",
    name: "Rice",
    unit: "serving",
    nutritionPerUnit: { carbs: 45, fat: 0.4, protein: 4 },
  },
  {
    id: "chicken",
    name: "Chicken",
    unit: "serving",
    nutritionPerUnit: { carbs: 0, fat: 3, protein: 31 },
  },
  {
    id: "oil",
    name: "Olive Oil",
    unit: "tbsp",
    nutritionPerUnit: { carbs: 0, fat: 14, protein: 0 },
  },
];

describe("solvePlan", () => {
  it("finds a plan within ranges and stock limits", async () => {
    const input: PlanInput = {
      foods,
      pantry: [
        { foodId: "rice", stock: 3 },
        { foodId: "chicken", stock: 3 },
        { foodId: "oil", stock: 2 },
      ],
      goal: {
        carbs: { min: 90, max: 100 },
        fat: { min: 14, max: 18 },
        protein: { min: 60, max: 70 },
      },
    };

    const result = await solvePlan(input);
    expect(result.status).toBe("sat");

    const totals = computeTotals(foods, result.servings);
    expect(totals.carbs).toBeGreaterThanOrEqual(90);
    expect(totals.carbs).toBeLessThanOrEqual(100);
    expect(totals.fat).toBeGreaterThanOrEqual(14);
    expect(totals.fat).toBeLessThanOrEqual(18);
    expect(totals.protein).toBeGreaterThanOrEqual(60);
    expect(totals.protein).toBeLessThanOrEqual(70);

    expect(result.servings.rice).toBeLessThanOrEqual(3);
    expect(result.servings.chicken).toBeLessThanOrEqual(3);
    expect(result.servings.oil).toBeLessThanOrEqual(2);
  });

  it("respects avoid constraints", async () => {
    const input: PlanInput = {
      foods,
      pantry: [
        { foodId: "rice", stock: 2 },
        { foodId: "chicken", stock: 2 },
        { foodId: "oil", stock: 2 },
      ],
      goal: {
        carbs: { min: 45, max: 90 },
        fat: { min: 3, max: 10 },
        protein: { min: 31, max: 70 },
      },
      constraints: {
        avoidFoodIds: ["oil"],
      },
    };

    const result = await solvePlan(input);
    expect(result.status).toBe("sat");
    expect(result.servings.oil).toBe(0);
  });

  it("returns unsat when the goal cannot be met", async () => {
    const input: PlanInput = {
      foods,
      pantry: [
        { foodId: "rice", stock: 1 },
        { foodId: "chicken", stock: 1 },
        { foodId: "oil", stock: 0 },
      ],
      goal: {
        carbs: { min: 200, max: 220 },
        fat: { min: 50, max: 60 },
        protein: { min: 100, max: 120 },
      },
    };

    const result = await solvePlan(input);
    expect(result.status).toBe("unsat");
    expect(result.servings).toEqual({});
  });
});

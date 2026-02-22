import { describe, expect, it } from "vitest";
import { computeTotals, solvePlan, solvePlanOptions } from "./solver";
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
        fat: { min: 6, max: 10 },
        protein: { min: 60, max: 70 },
      },
    };

    const result = await solvePlan(input);
    expect(result.status).toBe("sat");

    const totals = computeTotals(foods, result.servings);
    expect(totals.carbs).toBeGreaterThanOrEqual(90);
    expect(totals.carbs).toBeLessThanOrEqual(100);
    expect(totals.fat).toBeGreaterThanOrEqual(6);
    expect(totals.fat).toBeLessThanOrEqual(10);
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

describe("solvePlanOptions", () => {
  it("returns up to three options ordered by known price", async () => {
    const pricedFoods: Food[] = [
      {
        id: "cheap",
        name: "Cheap Carb",
        unit: "serving",
        price: 1,
        nutritionPerUnit: { carbs: 50, fat: 0, protein: 0 },
      },
      {
        id: "pricey",
        name: "Pricey Carb",
        unit: "serving",
        price: 4,
        nutritionPerUnit: { carbs: 50, fat: 0, protein: 0 },
      },
      {
        id: "unknown",
        name: "Unknown Price Carb",
        unit: "serving",
        nutritionPerUnit: { carbs: 50, fat: 0, protein: 0 },
      },
    ];

    const input: PlanInput = {
      foods: pricedFoods,
      pantry: [
        { foodId: "cheap", stock: 1 },
        { foodId: "pricey", stock: 1 },
        { foodId: "unknown", stock: 1 },
      ],
      goal: {
        carbs: { min: 100, max: 100 },
        fat: { min: 0, max: 0 },
        protein: { min: 0, max: 0 },
      },
    };

    const options = await solvePlanOptions(input, 3);
    expect(options.length).toBeGreaterThanOrEqual(2);

    expect(options[0].priceLowerBound).toBe(1);
    expect(options[0].hasUnknownPrice).toBe(true);

    expect(options[1].priceLowerBound).toBe(4);
    expect(options[1].hasUnknownPrice).toBe(true);

    if (options[2]) {
      expect(options[2].priceLowerBound).toBe(5);
      expect(options[2].hasUnknownPrice).toBe(false);
    }
  });
});

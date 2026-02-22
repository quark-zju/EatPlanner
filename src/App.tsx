import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { Food, Goal, PantryItem, PlanOption, PlanConstraints } from "./core";
import { solvePlanOptions } from "./core";
import {
  downloadTextFile,
  parseImportText,
  serializeExport,
} from "./storage/exportImport";

type AppState = {
  foods: Food[];
  pantry: PantryItem[];
  goal: Goal;
  constraints: PlanConstraints;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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

const isAppState = (value: unknown): value is AppState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as {
    foods?: unknown;
    pantry?: unknown;
    goal?: unknown;
    constraints?: unknown;
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
      unit?: unknown;
      nutritionPerUnit?: unknown;
      price?: unknown;
    };
    const priceOk = f.price === undefined || isNumber(f.price);
    return (
      typeof f.id === "string" &&
      typeof f.name === "string" &&
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
    return (
      typeof p.foodId === "string" &&
      (p.stock === "inf" || isNumber(p.stock))
    );
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
    isMacroRange(goal.carbs) &&
    isMacroRange(goal.fat) &&
    isMacroRange(goal.protein);

  const constraints = obj.constraints;
  const constraintsOk =
    constraints === undefined ||
    (typeof constraints === "object" &&
      constraints !== null &&
      ((constraints as { avoidFoodIds?: unknown }).avoidFoodIds === undefined ||
        (Array.isArray((constraints as { avoidFoodIds?: unknown }).avoidFoodIds) &&
          (constraints as { avoidFoodIds: unknown[] }).avoidFoodIds.every(
            (v) => typeof v === "string"
          ))) &&
      ((constraints as { preferFoodIds?: unknown }).preferFoodIds === undefined ||
        (Array.isArray((constraints as { preferFoodIds?: unknown }).preferFoodIds) &&
          (constraints as { preferFoodIds: unknown[] }).preferFoodIds.every(
            (v) => typeof v === "string"
          ))));

  return goalOk && constraintsOk;
};

const STORAGE_KEY = "eat-tracker-state-v1";

const defaultState: AppState = {
  foods: [
    {
      id: "rice",
      name: "Rice",
      unit: "serving",
      nutritionPerUnit: { carbs: 45, fat: 0.4, protein: 4 },
      price: 1.2,
    },
    {
      id: "chicken",
      name: "Chicken",
      unit: "serving",
      nutritionPerUnit: { carbs: 0, fat: 3, protein: 31 },
      price: 2.5,
    },
    {
      id: "olive-oil",
      name: "Olive Oil",
      unit: "tbsp",
      nutritionPerUnit: { carbs: 0, fat: 14, protein: 0 },
    },
  ],
  pantry: [
    { foodId: "rice", stock: 3 },
    { foodId: "chicken", stock: 3 },
    { foodId: "olive-oil", stock: 2 },
  ],
  goal: {
    carbs: { min: 90, max: 120 },
    fat: { min: 10, max: 22 },
    protein: { min: 60, max: 90 },
  },
  constraints: {
    avoidFoodIds: [],
    preferFoodIds: [],
  },
};

const safeParseState = (): AppState => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }
  try {
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...defaultState,
      ...parsed,
      constraints: {
        avoidFoodIds: parsed.constraints?.avoidFoodIds ?? [],
        preferFoodIds: parsed.constraints?.preferFoodIds ?? [],
      },
    };
  } catch {
    return defaultState;
  }
};

const formatPrice = (option: PlanOption) => {
  const base = option.priceLowerBound.toFixed(2);
  return option.hasUnknownPrice ? `${base}+` : base;
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `food-${Date.now()}`;

export default function App() {
  const [state, setState] = useState<AppState>(() => safeParseState());
  const [options, setOptions] = useState<PlanOption[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const pantryByFood = useMemo(() => {
    const map = new Map<string, PantryItem>();
    state.pantry.forEach((item) => map.set(item.foodId, item));
    return map;
  }, [state.pantry]);

  const updateFood = (foodId: string, updates: Partial<Food>) => {
    setState((prev) => ({
      ...prev,
      foods: prev.foods.map((food) =>
        food.id === foodId ? { ...food, ...updates } : food
      ),
    }));
  };

  const updateNutrition = (
    foodId: string,
    updates: Partial<Food["nutritionPerUnit"]>
  ) => {
    setState((prev) => ({
      ...prev,
      foods: prev.foods.map((food) =>
        food.id === foodId
          ? { ...food, nutritionPerUnit: { ...food.nutritionPerUnit, ...updates } }
          : food
      ),
    }));
  };

  const updateStock = (foodId: string, stock: PantryItem["stock"]) => {
    setState((prev) => {
      const existing = prev.pantry.find((item) => item.foodId === foodId);
      if (existing) {
        return {
          ...prev,
          pantry: prev.pantry.map((item) =>
            item.foodId === foodId ? { ...item, stock } : item
          ),
        };
      }
      return {
        ...prev,
        pantry: [...prev.pantry, { foodId, stock }],
      };
    });
  };

  const addFood = () => {
    const id = newId();
    setState((prev) => ({
      ...prev,
      foods: [
        ...prev.foods,
        {
          id,
          name: "New Food",
          unit: "serving",
          nutritionPerUnit: { carbs: 0, fat: 0, protein: 0 },
        },
      ],
      pantry: [...prev.pantry, { foodId: id, stock: 1 }],
    }));
  };

  const removeFood = (foodId: string) => {
    setState((prev) => ({
      ...prev,
      foods: prev.foods.filter((food) => food.id !== foodId),
      pantry: prev.pantry.filter((item) => item.foodId !== foodId),
      constraints: {
        avoidFoodIds: prev.constraints.avoidFoodIds?.filter((id) => id !== foodId),
        preferFoodIds: prev.constraints.preferFoodIds?.filter((id) => id !== foodId),
      },
    }));
  };

  const updateGoal = (
    key: keyof Goal,
    field: "min" | "max",
    value: number
  ) => {
    setState((prev) => ({
      ...prev,
      goal: {
        ...prev.goal,
        [key]: {
          ...prev.goal[key],
          [field]: value,
        },
      },
    }));
  };

  const toggleConstraint = (
    type: "avoidFoodIds" | "preferFoodIds",
    foodId: string
  ) => {
    setState((prev) => {
      const list = new Set(prev.constraints[type] ?? []);
      if (list.has(foodId)) {
        list.delete(foodId);
      } else {
        list.add(foodId);
      }
      return {
        ...prev,
        constraints: { ...prev.constraints, [type]: Array.from(list) },
      };
    });
  };

  const solve = async () => {
    setIsSolving(true);
    setError(null);
    try {
      if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
        throw new Error(
          "SharedArrayBuffer is unavailable. Reload after service worker registration or ensure COOP/COEP headers."
        );
      }
      const result = await solvePlanOptions(
        {
          foods: state.foods,
          pantry: state.pantry,
          goal: state.goal,
          constraints: state.constraints,
        },
        3
      );
      setOptions(result);
      if (result.length === 0) {
        setError(
          "No feasible plan found for the current goals and pantry. Try widening ranges or adding stock."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solver failed.");
    } finally {
      setIsSolving(false);
    }
  };

  const applyImportedState = (imported: AppState) => {
    setState({
      ...defaultState,
      ...imported,
      constraints: {
        avoidFoodIds: imported.constraints?.avoidFoodIds ?? [],
        preferFoodIds: imported.constraints?.preferFoodIds ?? [],
      },
    });
    setOptions([]);
    setError(null);
  };

  const exportStateToFile = () => {
    const content = serializeExport(state);
    downloadTextFile("eat-tracker-export.json", content);
  };

  const copyStateToClipboard = async () => {
    try {
      const content = serializeExport(state);
      await navigator.clipboard.writeText(content);
      setError("Export copied to clipboard.");
    } catch {
      setError("Clipboard write failed. Use Export File instead.");
    }
  };

  const importFromText = (text: string) => {
    const imported = parseImportText<AppState>(text, isAppState);
    applyImportedState(imported);
  };

  const importFromFile = async (file: File) => {
    const text = await file.text();
    importFromText(text);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      importFromText(text);
    } catch {
      setError("Clipboard read failed. Use Import File instead.");
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>EatTracker</h1>
          <p>Plan meals around the food you already have.</p>
        </div>
        <button className="primary" onClick={solve} disabled={isSolving}>
          {isSolving ? "Solving..." : "Generate Plans"}
        </button>
      </header>

      <main className="app__grid">
        <section className="card">
          <div className="card__header">
            <h2>Storage</h2>
            <button className="ghost" onClick={exportStateToFile}>
              Export File
            </button>
          </div>
          <div className="storage-actions">
            <button
              className="ghost"
              onClick={copyStateToClipboard}
              type="button"
            >
              Copy JSON
            </button>
            <button
              className="ghost"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Import File
            </button>
            <button className="ghost" onClick={pasteFromClipboard} type="button">
              Paste JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden-input"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                try {
                  await importFromFile(file);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Import failed.");
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </div>
          <p className="hint">
            Export uses a versioned schema to keep future migrations safe.
          </p>
        </section>

        <section className="card">
          <h2>Goals</h2>
          <div className="goal-grid">
            {(["carbs", "fat", "protein"] as const).map((macro) => (
              <div className="goal-row" key={macro}>
                <label className="macro-label">{macro}</label>
                <input
                  type="number"
                  value={state.goal[macro].min}
                  onChange={(event) =>
                    updateGoal(macro, "min", Number(event.target.value))
                  }
                />
                <span>to</span>
                <input
                  type="number"
                  value={state.goal[macro].max}
                  onChange={(event) =>
                    updateGoal(macro, "max", Number(event.target.value))
                  }
                />
                <span>g</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2>Pantry Foods</h2>
            <button className="ghost" onClick={addFood}>
              Add Food
            </button>
          </div>
          <div className="table">
            <div className="table__row table__head">
              <span>Name</span>
              <span>Unit</span>
              <span>Carbs</span>
              <span>Fat</span>
              <span>Protein</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Prefs</span>
            </div>
            {state.foods.map((food) => {
              const stock = pantryByFood.get(food.id)?.stock ?? 0;
              return (
                <div className="table__row" key={food.id}>
                  <input
                    value={food.name}
                    onChange={(event) =>
                      updateFood(food.id, { name: event.target.value })
                    }
                  />
                  <input
                    value={food.unit}
                    onChange={(event) =>
                      updateFood(food.id, { unit: event.target.value })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.carbs}
                    onChange={(event) =>
                      updateNutrition(food.id, {
                        carbs: Number(event.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.fat}
                    onChange={(event) =>
                      updateNutrition(food.id, { fat: Number(event.target.value) })
                    }
                  />
                  <input
                    type="number"
                    value={food.nutritionPerUnit.protein}
                    onChange={(event) =>
                      updateNutrition(food.id, {
                        protein: Number(event.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    value={food.price ?? ""}
                    placeholder="?"
                    onChange={(event) =>
                      updateFood(food.id, {
                        price:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  />
                  <input
                    type="text"
                    value={stock}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateStock(
                        food.id,
                        value === "inf" ? "inf" : Number(value)
                      );
                    }}
                  />
                  <div className="prefs">
                    <label>
                      <input
                        type="checkbox"
                        checked={state.constraints.preferFoodIds?.includes(
                          food.id
                        )}
                        onChange={() =>
                          toggleConstraint("preferFoodIds", food.id)
                        }
                      />
                      Prefer
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={state.constraints.avoidFoodIds?.includes(food.id)}
                        onChange={() =>
                          toggleConstraint("avoidFoodIds", food.id)
                        }
                      />
                      Avoid
                    </label>
                    <button
                      className="link"
                      onClick={() => removeFood(food.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="hint">
            Stock accepts numbers or <code>inf</code> for restaurant-style items.
          </p>
        </section>

        <section className="card">
          <h2>Plan Options</h2>
          {error && <p className="error">{error}</p>}
          {!error && options.length === 0 && (
            <p className="hint">Generate plans to see results.</p>
          )}
          <div className="options">
            {options.map((option, index) => (
              <article className="option" key={index}>
                <header>
                  <h3>Option {index + 1}</h3>
                  <span className="price">
                    ${formatPrice(option)} total
                  </span>
                </header>
                <div className="option__body">
                  <div>
                    <h4>Servings</h4>
                    <ul>
                      {Object.entries(option.servings).map(([foodId, amount]) => {
                        if (amount <= 0) {
                          return null;
                        }
                        const food = state.foods.find((f) => f.id === foodId);
                        return (
                          <li key={foodId}>
                            {food?.name ?? foodId}: {amount} {food?.unit}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <h4>Totals</h4>
                    <p>Carbs: {option.totals.carbs.toFixed(1)} g</p>
                    <p>Fat: {option.totals.fat.toFixed(1)} g</p>
                    <p>Protein: {option.totals.protein.toFixed(1)} g</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

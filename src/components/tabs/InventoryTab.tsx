import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  addFoodAtom,
  appStateAtom,
  getPantryByFoodAtom,
  moveFoodsToTopAtom,
  removeFoodsAtom,
  toggleConstraintAtom,
  updateFoodAtom,
  updateNutritionAtom,
  updateStockAtom,
} from "../../state/appAtoms";
import { DEFAULT_FOOD_ICON, getFoodIcon } from "../../state/appState";

export default function InventoryTab() {
  const state = useAtomValue(appStateAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const addFood = useSetAtom(addFoodAtom);
  const removeFoods = useSetAtom(removeFoodsAtom);
  const moveFoodsToTop = useSetAtom(moveFoodsToTopAtom);
  const updateFood = useSetAtom(updateFoodAtom);
  const updateNutrition = useSetAtom(updateNutritionAtom);
  const updateStock = useSetAtom(updateStockAtom);
  const toggleConstraint = useSetAtom(toggleConstraintAtom);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const selectedCount = selectedFoodIds.length;
  const selectedIdSet = useMemo(() => new Set(selectedFoodIds), [selectedFoodIds]);

  const toggleSelected = (foodId: string) => {
    setSelectedFoodIds((prev) =>
      prev.includes(foodId) ? prev.filter((id) => id !== foodId) : [...prev, foodId]
    );
  };

  const clearMissingSelections = () => {
    const validIds = new Set(state.foods.map((food) => food.id));
    setSelectedFoodIds((prev) => prev.filter((id) => validIds.has(id)));
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2>Pantry Foods</h2>
        <div className="storage-actions">
          <button
            className="ghost"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setSelectedFoodIds([])}
          >
            Deselect
          </button>
          <button
            className="ghost"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              moveFoodsToTop(selectedFoodIds);
              clearMissingSelections();
            }}
          >
            Move to top
          </button>
          <button
            className="ghost"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              removeFoods(selectedFoodIds);
              setSelectedFoodIds([]);
            }}
          >
            Delete {selectedCount} items
          </button>
          <button className="ghost" onClick={() => addFood()} type="button">
            Add Food
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="editor-table pantry-editor-table">
          <thead>
            <tr>
              <th aria-label="Select foods"></th>
              <th>Name</th>
              <th>Icon</th>
              <th>Unit</th>
              <th>Carbs</th>
              <th>Fat</th>
              <th>Protein</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Prefs</th>
            </tr>
          </thead>
          <tbody>
            {state.foods.map((food) => {
              const stock = pantryByFood.get(food.id)?.stock ?? 0;
              return (
                <tr key={food.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(food.id)}
                      onChange={() => toggleSelected(food.id)}
                    />
                  </td>
                  <td>
                    <input
                      value={food.name}
                      onChange={(event) =>
                        updateFood({ foodId: food.id, updates: { name: event.target.value } })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={food.icon ?? ""}
                      placeholder={DEFAULT_FOOD_ICON}
                      maxLength={8}
                      onChange={(event) =>
                        updateFood({
                          foodId: food.id,
                          updates: {
                            icon: event.target.value.trim() === "" ? undefined : event.target.value,
                          },
                        })
                      }
                    />
                    <p className="icon-preview">{getFoodIcon(food.icon)}</p>
                  </td>
                  <td>
                    <input
                      value={food.unit}
                      onChange={(event) =>
                        updateFood({ foodId: food.id, updates: { unit: event.target.value } })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={food.nutritionPerUnit.carbs}
                      onChange={(event) =>
                        updateNutrition({
                          foodId: food.id,
                          updates: { carbs: Number(event.target.value) },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={food.nutritionPerUnit.fat}
                      onChange={(event) =>
                        updateNutrition({
                          foodId: food.id,
                          updates: { fat: Number(event.target.value) },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={food.nutritionPerUnit.protein}
                      onChange={(event) =>
                        updateNutrition({
                          foodId: food.id,
                          updates: { protein: Number(event.target.value) },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={food.price ?? ""}
                      placeholder="?"
                      onChange={(event) =>
                        updateFood({
                          foodId: food.id,
                          updates: {
                            price:
                              event.target.value === "" ? undefined : Number(event.target.value),
                          },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={stock}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateStock({
                          foodId: food.id,
                          stock: value === "inf" ? "inf" : Number(value),
                        });
                      }}
                    />
                  </td>
                  <td>
                    <div className="prefs">
                      <label>
                        <input
                          type="checkbox"
                          checked={state.constraints.preferFoodIds?.includes(food.id)}
                          onChange={() =>
                            toggleConstraint({ type: "preferFoodIds", foodId: food.id })
                          }
                        />
                        Prefer
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={state.constraints.avoidFoodIds?.includes(food.id)}
                          onChange={() =>
                            toggleConstraint({ type: "avoidFoodIds", foodId: food.id })
                          }
                        />
                        Avoid
                      </label>
                      <button
                        className="link"
                        type="button"
                        onClick={() => {
                          removeFoods([food.id]);
                          setSelectedFoodIds((prev) => prev.filter((id) => id !== food.id));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Stock accepts numbers or inf for restaurant-style items.</p>
    </section>
  );
}

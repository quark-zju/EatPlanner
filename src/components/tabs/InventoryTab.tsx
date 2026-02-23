import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import {
  appStateAtom,
  getPantryByFoodAtom,
} from "../../state/appAtoms";
import {
  addFoodFromEditor,
  moveFoodsToTop,
  removeFoods,
  updateFood,
  updateNutrition,
  updateStock,
} from "../../state/appInventoryActions";
import { DEFAULT_FOOD_ICON, getFoodIcon } from "../../state/appState";

export default function InventoryTab() {
  const state = useAtomValue(appStateAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [newFood, setNewFood] = useState({
    name: "",
    icon: "",
    unit: "serving",
    carbs: "0",
    fat: "0",
    protein: "0",
    price: "",
    stock: "1",
  });
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

  const commitNewFood = () => {
    const name = newFood.name.trim();
    if (!name) {
      return;
    }

    const stockValue = newFood.stock.trim().toLowerCase();
    addFoodFromEditor({
      name,
      icon: newFood.icon.trim() || undefined,
      unit: newFood.unit.trim() || "serving",
      carbs: Number(newFood.carbs),
      fat: Number(newFood.fat),
      protein: Number(newFood.protein),
      price: newFood.price.trim() === "" ? undefined : Number(newFood.price),
      stock: stockValue === "inf" ? "inf" : Number(newFood.stock),
    });

    setNewFood({
      name: "",
      icon: "",
      unit: "serving",
      carbs: "0",
      fat: "0",
      protein: "0",
      price: "",
      stock: "1",
    });
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
                </tr>
              );
            })}
            <tr>
              <td></td>
              <td>
                <input
                  value={newFood.name}
                  placeholder="New food name..."
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, name: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  value={newFood.icon}
                  placeholder={DEFAULT_FOOD_ICON}
                  maxLength={8}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, icon: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  value={newFood.unit}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, unit: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={newFood.carbs}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, carbs: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={newFood.fat}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, fat: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={newFood.protein}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, protein: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={newFood.price}
                  placeholder="?"
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, price: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={newFood.stock}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, stock: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitNewFood();
                    }
                  }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">Stock accepts numbers or inf for restaurant-style items.</p>
    </section>
  );
}

import { useAtomValue, useSetAtom } from "jotai";
import {
  addFoodAtom,
  appStateAtom,
  getPantryByFoodAtom,
  removeFoodAtom,
  toggleConstraintAtom,
  updateFoodAtom,
  updateNutritionAtom,
  updateStockAtom,
} from "../../state/appAtoms";

export default function InventoryTab() {
  const state = useAtomValue(appStateAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const addFood = useSetAtom(addFoodAtom);
  const removeFood = useSetAtom(removeFoodAtom);
  const updateFood = useSetAtom(updateFoodAtom);
  const updateNutrition = useSetAtom(updateNutritionAtom);
  const updateStock = useSetAtom(updateStockAtom);
  const toggleConstraint = useSetAtom(toggleConstraintAtom);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Pantry Foods</h2>
        <button className="ghost" onClick={() => addFood()}>
          Add Food
        </button>
      </div>
      <div className="table-scroll">
        <table className="editor-table pantry-editor-table">
          <thead>
            <tr>
              <th>Name</th>
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
                      value={food.name}
                      onChange={(event) =>
                        updateFood({ foodId: food.id, updates: { name: event.target.value } })
                      }
                    />
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
                      <button className="link" onClick={() => removeFood(food.id)}>
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

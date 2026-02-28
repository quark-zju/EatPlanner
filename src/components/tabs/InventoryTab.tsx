import { useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  appStateAtom,
  getPantryByFoodAtom,
} from "../../state/appAtoms";
import { openAiKeyAtom } from "../../state/appOpenAi";
import { requestFoodVision, resizeImageFile } from "../../core/foodVision";
import { setAppError, setAppNotice } from "../../state/appStoreActions";
import {
  addFoodFromEditor,
  moveFoodsToTop,
  removeFoods,
  updateFood,
  updateNutrition,
  updateStock,
} from "../../state/appInventoryActions";
import { DEFAULT_FOOD_ICON } from "../../state/appState";
import { inferFoodIconFromName } from "../../state/foodIcons";

const EMPTY_NEW_FOOD = {
  name: "",
  icon: "",
  unit: "serving",
  carbs: "0",
  fat: "0",
  protein: "0",
  price: "",
  stock: "1",
};

export default function InventoryTab() {
  const state = useAtomValue(appStateAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const openAiKey = useAtomValue(openAiKeyAtom);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [newFood, setNewFood] = useState(EMPTY_NEW_FOOD);
  const [visionBusy, setVisionBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = selectedFoodIds.length;
  const hasSelection = selectedCount > 0;
  const canAddNewFood = newFood.name.trim().length > 0;
  const inferredNewFoodIcon = inferFoodIconFromName(newFood.name);
  const newFoodIconPlaceholder = inferredNewFoodIcon ?? DEFAULT_FOOD_ICON;
  const hasOpenAiKey = openAiKey.trim().length > 0;
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

  const parsePriceInput = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const ratioMatch = trimmed.match(
      /^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([1-9][0-9]*)$/
    );
    if (ratioMatch) {
      const numerator = Number(ratioMatch[1]);
      const denominator = Number(ratioMatch[2]);
      return numerator / denominator;
    }

    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : undefined;
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
      price: parsePriceInput(newFood.price),
      stock: stockValue === "inf" ? "inf" : Number(newFood.stock),
    });

    setNewFood(EMPTY_NEW_FOOD);
  };

  const handleVisionUpload = async (file: File) => {
    if (!hasOpenAiKey) {
      setAppError("Add an OpenAI API key in Settings first.");
      return;
    }
    setAppNotice(null);
    setAppError(null);
    setVisionBusy(true);
    try {
      const resized = await resizeImageFile(file);
      const result = await requestFoodVision({
        apiKey: openAiKey.trim(),
        dataUrl: resized.dataUrl,
      });
      setNewFood((prev) => ({
        ...prev,
        name: result.name ?? prev.name,
        unit: result.unit,
        carbs: String(result.carbs ?? 0),
        fat: String(result.fat ?? 0),
        protein: String(result.protein ?? 0),
        price: result.price === undefined ? prev.price : String(result.price),
      }));
      setAppNotice(
        result.confidence === "label"
          ? "Nutrition label parsed. Review and edit before adding."
          : "Nutrition estimated from photo. Review and edit before adding."
      );
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Image recognition failed.");
    } finally {
      setVisionBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2>Pantry Foods</h2>
        <div className="storage-actions">
          <>
            <button
              className={`ghost ${!hasOpenAiKey ? "is-disabled" : ""}`}
              type="button"
              onClick={() => {
                if (!hasOpenAiKey) {
                  setAppNotice("Add an OpenAI API key in Settings to use photo recognition.");
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={visionBusy}
            >
              {visionBusy ? "Analyzing..." : "Add from photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden-input"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                await handleVisionUpload(file);
                event.target.value = "";
              }}
            />
          </>
          <button
            className="ghost"
            type="button"
            disabled={!hasSelection}
            onClick={() => setSelectedFoodIds([])}
          >
            Deselect
          </button>
          <button
            className="ghost"
            type="button"
            disabled={!hasSelection}
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
            disabled={!hasSelection}
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
              <th className="col-name">Name</th>
              <th className="col-icon">Icon</th>
              <th className="col-unit">Unit</th>
              <th className="col-right">Carbs</th>
              <th className="col-right">Fat</th>
              <th className="col-right">Protein</th>
              <th className="col-right">Price</th>
              <th className="col-right">Stock</th>
              <th>Select</th>
            </tr>
          </thead>
          <tbody>
            {state.foods.map((food) => {
              const stock = pantryByFood.get(food.id)?.stock ?? 0;
              return (
                <tr key={food.id}>
                  <td className="col-name">
                    <input
                      value={food.name}
                      onChange={(event) =>
                        updateFood({ foodId: food.id, updates: { name: event.target.value } })
                      }
                    />
                  </td>
                  <td className="col-icon">
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
                  </td>
                  <td className="col-unit">
                    <input
                      value={food.unit}
                      onChange={(event) =>
                        updateFood({ foodId: food.id, updates: { unit: event.target.value } })
                      }
                    />
                  </td>
                  <td className="col-right">
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
                  <td className="col-right">
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
                  <td className="col-right">
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
                  <td className="col-right">
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
                  <td className="col-right">
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
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(food.id)}
                      onChange={() => toggleSelected(food.id)}
                      aria-label={`Select ${food.name}`}
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="col-name">
                <input
                  value={newFood.name}
                  placeholder="New food name..."
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </td>
              <td className="col-icon">
                <input
                  value={newFood.icon}
                  placeholder={newFoodIconPlaceholder}
                  maxLength={8}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, icon: event.target.value }))
                  }
                />
              </td>
              <td className="col-unit">
                <input
                  value={newFood.unit}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, unit: event.target.value }))
                  }
                />
              </td>
              <td className="col-right">
                <input
                  type="number"
                  value={newFood.carbs}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, carbs: event.target.value }))
                  }
                />
              </td>
              <td className="col-right">
                <input
                  type="number"
                  value={newFood.fat}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, fat: event.target.value }))
                  }
                />
              </td>
              <td className="col-right">
                <input
                  type="number"
                  value={newFood.protein}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, protein: event.target.value }))
                  }
                />
              </td>
              <td className="col-right">
                <input
                  type="text"
                  value={newFood.price}
                  placeholder="? or 3/2"
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </td>
              <td className="col-right">
                <input
                  type="text"
                  value={newFood.stock}
                  onChange={(event) =>
                    setNewFood((prev) => ({ ...prev, stock: event.target.value }))
                  }
                />
              </td>
              <td>
                <button
                  className="ghost"
                  type="button"
                  disabled={!canAddNewFood}
                  onClick={() => commitNewFood()}
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">Stock accepts numbers or inf for restaurant-style items.</p>
    </section>
  );
}

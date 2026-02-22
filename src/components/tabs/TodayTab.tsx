import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  addDraftFoodFromPantryAtom,
  addFoodAtom,
  appStateAtom,
  draftPriceSummaryAtom,
  generatePlanOptionsAtom,
  getPantryByFoodAtom,
  planOptionsAtom,
  removeDraftItemAtom,
  removeFoodAtom,
  selectPlanOptionToDraftAtom,
  solvingAtom,
  submitDraftToHistoryAtom,
  toggleConstraintAtom,
  updateDraftQuantityAtom,
  updateFoodAtom,
  updateNutritionAtom,
  updateStockAtom,
  setDraftDateAtom,
} from "../../state/appAtoms";

const formatPrice = (priceLowerBound: number, hasUnknownPrice: boolean) => {
  const base = priceLowerBound.toFixed(2);
  return hasUnknownPrice ? `${base}+` : base;
};

export default function TodayTab() {
  const state = useAtomValue(appStateAtom);
  const options = useAtomValue(planOptionsAtom);
  const isSolving = useAtomValue(solvingAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const draftPrice = useAtomValue(draftPriceSummaryAtom);

  const generatePlans = useSetAtom(generatePlanOptionsAtom);
  const selectOptionToDraft = useSetAtom(selectPlanOptionToDraftAtom);
  const updateDraftQty = useSetAtom(updateDraftQuantityAtom);
  const setDraftDate = useSetAtom(setDraftDateAtom);
  const addDraftFood = useSetAtom(addDraftFoodFromPantryAtom);
  const removeDraftItem = useSetAtom(removeDraftItemAtom);
  const submitDraft = useSetAtom(submitDraftToHistoryAtom);

  const addFood = useSetAtom(addFoodAtom);
  const removeFood = useSetAtom(removeFoodAtom);
  const updateFood = useSetAtom(updateFoodAtom);
  const updateNutrition = useSetAtom(updateNutritionAtom);
  const updateStock = useSetAtom(updateStockAtom);
  const toggleConstraint = useSetAtom(toggleConstraintAtom);

  const [selectedDraftFoodId, setSelectedDraftFoodId] = useState<string>("");
  const availableDraftFoods = state.foods.filter((food) => pantryByFood.has(food.id));

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>Planner</h2>
          <button className="primary" onClick={() => generatePlans()} disabled={isSolving}>
            {isSolving ? "Solving..." : "Generate Plans"}
          </button>
        </div>
        <p className="hint">
          Goal ranges are configured in the <strong>Settings</strong> tab.
        </p>
        {options.length === 0 && <p className="hint">Generate plans to get suggestions.</p>}
        <div className="options">
          {options.map((option, index) => (
            <article className="option" key={`${index}-${option.priceLowerBound}`}>
              <header>
                <h3>Option {index + 1}</h3>
                <span className="price">
                  ${formatPrice(option.priceLowerBound, option.hasUnknownPrice)}
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
              <button
                className="ghost"
                onClick={() =>
                  selectOptionToDraft({
                    optionIndex: index,
                    dateISO: state.todayDraft.draftDateISO,
                  })
                }
                type="button"
              >
                Use This Plan
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Draft Editor</h2>
        </div>
        <div className="draft-controls">
          <label>
            Date
            <input
              type="date"
              value={state.todayDraft.draftDateISO}
              onChange={(event) => setDraftDate(event.target.value)}
            />
          </label>
          <label>
            Add Pantry Food
            <div className="inline-actions">
              <select
                value={selectedDraftFoodId}
                onChange={(event) => setSelectedDraftFoodId(event.target.value)}
              >
                <option value="">Select food...</option>
                {availableDraftFoods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </select>
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  if (!selectedDraftFoodId) {
                    return;
                  }
                  addDraftFood(selectedDraftFoodId);
                }}
                disabled={!selectedDraftFoodId}
              >
                Add
              </button>
            </div>
          </label>
        </div>

        {state.todayDraft.items.length === 0 && (
          <p className="hint">Select a plan option to prefill this editor.</p>
        )}

        {state.todayDraft.items.length > 0 && (
          <div className="table draft-table">
            <div className="table__row table__head draft-row">
              <span>Food</span>
              <span>Unit</span>
              <span>Quantity</span>
              <span>Action</span>
            </div>
            {state.todayDraft.items.map((item) => (
              <div className="table__row draft-row" key={item.foodId}>
                <span>{item.foodNameSnapshot}</span>
                <span>{item.unitSnapshot}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateDraftQty({
                      foodId: item.foodId,
                      quantity: Number(event.target.value),
                    })
                  }
                />
                <button className="link" type="button" onClick={() => removeDraftItem(item.foodId)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="draft-summary">
          <p>Carbs: {state.todayDraft.totals.carbs.toFixed(1)} g</p>
          <p>Fat: {state.todayDraft.totals.fat.toFixed(1)} g</p>
          <p>Protein: {state.todayDraft.totals.protein.toFixed(1)} g</p>
          <p>Price: ${formatPrice(draftPrice.priceLowerBound, draftPrice.hasUnknownPrice)}</p>
        </div>

        <button className="primary" onClick={() => submitDraft()} type="button">
          Save To History
        </button>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Pantry Foods</h2>
          <button className="ghost" onClick={() => addFood()}>
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
                    updateFood({ foodId: food.id, updates: { name: event.target.value } })
                  }
                />
                <input
                  value={food.unit}
                  onChange={(event) =>
                    updateFood({ foodId: food.id, updates: { unit: event.target.value } })
                  }
                />
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
              </div>
            );
          })}
        </div>
        <p className="hint">
          Stock accepts numbers or <code>inf</code> for restaurant-style items.
        </p>
      </section>
    </>
  );
}

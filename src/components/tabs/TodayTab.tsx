import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  addDraftFoodFromPantryAtom,
  appStateAtom,
  draftPriceSummaryAtom,
  generatePlanOptionsAtom,
  getPantryByFoodAtom,
  planOptionsAtom,
  removeDraftItemAtom,
  selectPlanOptionToDraftAtom,
  solvingAtom,
  submitDraftToHistoryAtom,
  updateDraftQuantityAtom,
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
          <div className="table-scroll">
            <table className="editor-table draft-editor-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.todayDraft.items.map((item) => (
                  <tr key={item.foodId}>
                    <td>{item.foodNameSnapshot}</td>
                    <td>{item.unitSnapshot}</td>
                    <td>
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
                    </td>
                    <td>
                      <button
                        className="link"
                        type="button"
                        onClick={() => removeDraftItem(item.foodId)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

    </>
  );
}

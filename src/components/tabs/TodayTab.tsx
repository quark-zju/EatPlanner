import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import {
  appStateAtom,
  draftPriceSummaryAtom,
  getPantryByFoodAtom,
  planOptionsAtom,
  solvingAtom,
} from "../../state/appAtoms";
import {
  addDraftFoodFromPantry,
  removeDraftItem,
  selectPlanOptionToDraft,
  setDraftDate,
  submitDraftToHistory,
} from "../../state/appDraftActions";
import { generatePlanOptions } from "../../state/appPlannerActions";
import { getFoodIcon } from "../../state/appState";
import NutritionGoalStats from "../NutritionGoalStats";

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

  const generatePlans = generatePlanOptions;
  const selectOptionToDraft = selectPlanOptionToDraft;
  const addDraftFood = addDraftFoodFromPantry;
  const removeDraft = removeDraftItem;
  const submitDraft = submitDraftToHistory;
  const [localAvoidFoodIds, setLocalAvoidFoodIds] = useState<string[]>([]);

  const availableDraftFoods = state.foods.filter((food) => pantryByFood.has(food.id));
  const draftItemByFoodId = new Map(
    state.todayDraft.items.map((item) => [item.foodId, item])
  );
  const localAvoidSet = useMemo(() => new Set(localAvoidFoodIds), [localAvoidFoodIds]);

  const toggleLocalAvoid = (foodId: string) => {
    setLocalAvoidFoodIds((prev) =>
      prev.includes(foodId) ? prev.filter((id) => id !== foodId) : [...prev, foodId]
    );
  };

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>Planner</h2>
          <button
            className="primary"
            onClick={() => generatePlans({ localAvoidFoodIds })}
            disabled={isSolving}
          >
            {isSolving ? "Solving..." : "Generate Plans"}
          </button>
        </div>
        <p className="hint">
          Goal ranges are configured in the <strong>Settings</strong> tab.
        </p>
        <p className="hint">Use x in results to mark local avoid items for this session.</p>
        {localAvoidFoodIds.length > 0 && (
          <div className="local-avoid-list">
            {localAvoidFoodIds.map((foodId) => {
              const food = state.foods.find((f) => f.id === foodId);
              return (
                <button
                  className="ghost"
                  key={foodId}
                  type="button"
                  onClick={() => toggleLocalAvoid(foodId)}
                >
                  {getFoodIcon(food?.icon)} {food?.name ?? foodId} x
                </button>
              );
            })}
          </div>
        )}
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
                      const isLocallyAvoided = localAvoidSet.has(foodId);
                      return (
                        <li key={foodId} className={isLocallyAvoided ? "option-food is-avoid" : "option-food"}>
                          <span className="option-food__main">
                            <span>{getFoodIcon(food?.icon)}</span>
                            <span>
                              {food?.name ?? foodId}: {amount} {food?.unit}
                            </span>
                          </span>
                          <button
                            className="option-food__avoid"
                            type="button"
                            onClick={() => toggleLocalAvoid(foodId)}
                            title={isLocallyAvoided ? "Unmark avoid" : "Mark as avoid"}
                          >
                            x
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <h4>Totals</h4>
                  <NutritionGoalStats totals={option.totals} goal={state.goal} />
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
          <h2>What did you eat?</h2>
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
        </div>

        <p className="hint">Click a food tile to add +1 unit. Use x to clear that item.</p>
        <div className="draft-grid">
          {availableDraftFoods.map((food) => {
            const item = draftItemByFoodId.get(food.id);
            const quantity = item?.quantity ?? 0;
            return (
              <div
                className={`draft-tile-wrap ${quantity > 0 ? "is-selected" : ""}`}
                key={food.id}
              >
                <button
                  className="draft-tile"
                  type="button"
                  onClick={() => addDraftFood(food.id)}
                  title={`Add 1 ${food.unit}`}
                >
                  <span className="draft-tile__icon">{getFoodIcon(item?.foodIconSnapshot ?? food.icon)}</span>
                  <span className="draft-tile__name">{item?.foodNameSnapshot ?? food.name}</span>
                  <span className="draft-tile__qty">
                    {quantity} {food.unit}
                  </span>
                </button>
                {quantity > 0 && (
                  <button
                    className="draft-tile__clear"
                    type="button"
                    onClick={() => removeDraft(food.id)}
                    title="Clear item"
                  >
                    x
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="draft-summary">
          <NutritionGoalStats totals={state.todayDraft.totals} goal={state.goal} />
          <p>Price: ${formatPrice(draftPrice.priceLowerBound, draftPrice.hasUnknownPrice)}</p>
        </div>

        <button className="primary" onClick={() => submitDraft()} type="button">
          Save To History
        </button>
      </section>

    </>
  );
}

import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { formatQuantityWithUnit } from "../../core";
import {
  appStateAtom,
  draftPriceSummaryAtom,
  getPantryByFoodAtom,
  plannerContextMessageAtom,
  plannerRemainingGoalAtom,
  plannerMessageAtom,
  planOptionsAtom,
  solvingAtom,
} from "../../state/appAtoms";
import {
  addDraftFoodFromPantry,
  clearDraftItems,
  removeDraftItem,
  selectPlanOptionToDraft,
  setDraftDate,
  submitDraftToHistory,
  updateDraftQuantity,
} from "../../state/appDraftActions";
import { generatePlanOptions } from "../../state/appPlannerActions";
import { getFoodIcon } from "../../state/appState";
import NutritionGoalCard from "../NutritionGoalCard";
import NutritionGoalStats from "../NutritionGoalStats";

const formatPrice = (priceLowerBound: number, hasUnknownPrice: boolean) => {
  const base = priceLowerBound.toFixed(2);
  return hasUnknownPrice ? `${base}+` : base;
};

export default function TodayTab() {
  const state = useAtomValue(appStateAtom);
  const options = useAtomValue(planOptionsAtom);
  const isSolving = useAtomValue(solvingAtom);
  const plannerMessage = useAtomValue(plannerMessageAtom);
  const plannerContextMessage = useAtomValue(plannerContextMessageAtom);
  const plannerRemainingGoal = useAtomValue(plannerRemainingGoalAtom);
  const pantryByFood = useAtomValue(getPantryByFoodAtom);
  const draftPrice = useAtomValue(draftPriceSummaryAtom);

  const generatePlans = generatePlanOptions;
  const selectOptionToDraft = selectPlanOptionToDraft;
  const addDraftFood = addDraftFoodFromPantry;
  const clearDraft = clearDraftItems;
  const removeDraft = removeDraftItem;
  const submitDraft = submitDraftToHistory;
  const updateDraftQty = updateDraftQuantity;
  const [localAvoidFoodIds, setLocalAvoidFoodIds] = useState<string[]>([]);

  const availableDraftFoods = state.foods.filter((food) => pantryByFood.has(food.id));
  const draftItemByFoodId = new Map(
    state.todayDraft.items.map((item) => [item.foodId, item])
  );
  const hasAnySelection = state.todayDraft.items.some((item) => item.quantity > 0);
  const localAvoidSet = useMemo(() => new Set(localAvoidFoodIds), [localAvoidFoodIds]);

  const toggleLocalAvoid = (foodId: string) => {
    setLocalAvoidFoodIds((prev) =>
      prev.includes(foodId) ? prev.filter((id) => id !== foodId) : [...prev, foodId]
    );
  };
  
  const shouldShowHowToUse = (plannerMessage == null && options.length === 0);

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
        {shouldShowHowToUse && (
        <p className="hint">
          Update your <strong>Inventory</strong> and <strong>Settings → Goals</strong>, then use the
          <strong> Generate Plans</strong> button at the top right to find suitable meal plans.
        </p>
        )}
        {plannerMessage && <p className="hint">{plannerMessage}</p>}
        {(options.length > 0 || plannerMessage) && plannerContextMessage && (
          <p className="hint">{plannerContextMessage}</p>
        )}
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
                            <span title={food?.name ?? foodId}>{getFoodIcon(food?.icon)}</span>
                            <span>
                              {food?.name ?? foodId}: {formatQuantityWithUnit(amount, food?.unit)}
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
                <NutritionGoalCard totals={option.totals} goal={plannerRemainingGoal} title="Totals" />
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
                Use this plan
              </button>
            </article>
          ))}
        </div>
        {localAvoidFoodIds.length > 0 && (
          <>
            <p>Avoid:</p>
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
          </>
        )}
        {options.length > 0 && (
          <p className="hint">Use x in results to avoid items. Click <b>Generate Plans</b> to refresh options.</p>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>What did you eat?</h2>
          <div className="inline-actions">
            <button
              className="ghost"
              onClick={() => clearDraft()}
              type="button"
              disabled={!hasAnySelection}
            >
              Clear
            </button>
            <button
              className="primary"
              onClick={() => submitDraft()}
              type="button"
              disabled={!hasAnySelection}
            >
              Save To History
            </button>
          </div>
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

        <p className="hint draft-grid-hint">Click a food tile to add +1 unit. Use x to clear that item.</p>
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
                    {formatQuantityWithUnit(quantity, food.unit)}
                  </span>
                </button>
                {quantity > 0 && (
                  <>
                    <button
                      className="draft-tile__decrement"
                      type="button"
                      onClick={() =>
                        updateDraftQty({
                          foodId: food.id,
                          quantity: Math.max(0, quantity - 1),
                        })
                      }
                      title="Reduce by 1"
                    >
                      -
                    </button>
                    <button
                      className="draft-tile__clear"
                      type="button"
                      onClick={() => removeDraft(food.id)}
                      title="Clear item"
                    >
                      x
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="draft-summary">
          <NutritionGoalStats totals={state.todayDraft.totals} goal={state.goal} />
          <p className="draft-summary__price">
            <strong>Price</strong>
            <span>${formatPrice(draftPrice.priceLowerBound, draftPrice.hasUnknownPrice)}</span>
          </p>
        </div>
      </section>

    </>
  );
}

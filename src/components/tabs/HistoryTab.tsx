import { useAtomValue } from "jotai";
import {
  appStateAtom,
  historyDaysInWindowAtom,
  historyWindowRangeAtom,
} from "../../state/appAtoms";
import { setHistoryWindow, setSelectedHistoryDate } from "../../state/appDomainActions";
import { getFoodIcon } from "../../state/appState";
import NutritionGoalStats from "../NutritionGoalStats";

const formatPrice = (priceLowerBound: number, hasUnknownPrice: boolean) => {
  const base = priceLowerBound.toFixed(2);
  return hasUnknownPrice ? `${base}+` : base;
};

export default function HistoryTab() {
  const state = useAtomValue(appStateAtom);
  const range = useAtomValue(historyWindowRangeAtom);
  const historyDays = useAtomValue(historyDaysInWindowAtom);

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>History</h2>
          <div className="storage-actions">
            <button className="ghost" onClick={() => setHistoryWindow("prev")} type="button">
              Previous 30 days
            </button>
            <button className="ghost" onClick={() => setHistoryWindow("next")} type="button">
              Next 30 days
            </button>
            <button className="ghost" onClick={() => setHistoryWindow("today")} type="button">
              Jump To Current
            </button>
          </div>
        </div>

        <p className="hint">
          Showing {range.startISO} to {range.endISO}
        </p>

        {historyDays.length === 0 && (
          <p className="hint">No history entries in this 30-day window.</p>
        )}

        <div className="history-list">
          {historyDays.map(({ dateISO, record }) => {
            const selected = state.ui.selectedHistoryDateISO === dateISO;
            return (
              <article className="history-item" key={dateISO}>
                <button
                  className={`history-item__header ${selected ? "is-active" : ""}`}
                  onClick={() => setSelectedHistoryDate(selected ? undefined : dateISO)}
                  type="button"
                >
                  <strong>{dateISO}</strong>
                  <span>{record.items.length} items</span>
                  <span>${formatPrice(record.priceLowerBound, record.hasUnknownPrice)}</span>
                </button>

                {selected && (
                  <div className="history-item__details">
                    <NutritionGoalStats totals={record.totals} goal={record.goalSnapshot} />
                    <p>
                      Goal: Carbs {record.goalSnapshot.carbs.min}-{record.goalSnapshot.carbs.max} g,
                      Fat {record.goalSnapshot.fat.min}-{record.goalSnapshot.fat.max} g,
                      Protein {record.goalSnapshot.protein.min}-{record.goalSnapshot.protein.max} g
                    </p>
                    <p>Submitted: {new Date(record.submittedAtISO).toLocaleString()}</p>
                    <ul>
                      {record.items.map((item) => (
                        <li key={`${dateISO}-${item.foodId}`}>
                          {getFoodIcon(item.foodIconSnapshot)} {item.foodNameSnapshot}:{" "}
                          {item.quantity} {item.unitSnapshot}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

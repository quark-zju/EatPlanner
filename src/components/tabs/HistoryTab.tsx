import { useAtomValue } from "jotai";
import {
  appStateAtom,
  historyDaysInWindowAtom,
  historyWindowRangeAtom,
} from "../../state/appAtoms";
import { setHistoryWindow, setSelectedHistoryDate } from "../../state/appDomainActions";
import { getFoodIcon } from "../../state/appState";
import NutritionGoalCard from "../NutritionGoalCard";

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
            const headerItems = record.items
              .filter((item) => item.quantity > 0)
              .slice(0, 4);
            return (
              <article className="history-item" key={dateISO}>
                <button
                  className={`history-item__header ${selected ? "is-active" : ""}`}
                  onClick={() => setSelectedHistoryDate(selected ? undefined : dateISO)}
                  type="button"
                >
                  <strong>{dateISO}</strong>
                  <span className="history-item__icons">
                    {headerItems.length === 0 && <span>No items</span>}
                    {headerItems.map((item) => (
                      <span
                        key={`${dateISO}-h-${item.foodId}`}
                        className="history-item__icon-chip"
                        title={`${item.foodNameSnapshot}: ${item.quantity} ${item.unitSnapshot}`}
                      >
                        {getFoodIcon(item.foodIconSnapshot)} x {item.quantity}
                      </span>
                    ))}
                    {record.items.filter((item) => item.quantity > 0).length > headerItems.length && (
                      <span>...</span>
                    )}
                  </span>
                  <span>${formatPrice(record.priceLowerBound, record.hasUnknownPrice)}</span>
                </button>

                {selected && (
                  <div className="history-item__details">
                    <div className="history-item__detail-grid">
                      <div>
                        <p>Submitted: {new Date(record.submittedAtISO).toLocaleString()}</p>
                        <ul>
                          {record.items.map((item) => (
                            <li key={`${dateISO}-${item.foodId}`}>
                              <span title={item.foodNameSnapshot}>
                                {getFoodIcon(item.foodIconSnapshot)}
                              </span>{" "}
                              {item.foodNameSnapshot}: {item.quantity} {item.unitSnapshot}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <NutritionGoalCard
                        totals={record.totals}
                        goal={record.goalSnapshot}
                        title="Goal Match"
                      />
                    </div>
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

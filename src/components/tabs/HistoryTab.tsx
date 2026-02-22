import { useAtomValue, useSetAtom } from "jotai";
import {
  appStateAtom,
  historyAggregatesInWindowAtom,
  historyDaysInWindowAtom,
  historyWindowRangeAtom,
  setHistoryWindowAtom,
  setSelectedHistoryDateAtom,
} from "../../state/appAtoms";

const formatPrice = (priceLowerBound: number, hasUnknownPrice: boolean) => {
  const base = priceLowerBound.toFixed(2);
  return hasUnknownPrice ? `${base}+` : base;
};

export default function HistoryTab() {
  const state = useAtomValue(appStateAtom);
  const range = useAtomValue(historyWindowRangeAtom);
  const historyDays = useAtomValue(historyDaysInWindowAtom);
  const aggregate = useAtomValue(historyAggregatesInWindowAtom);

  const setWindow = useSetAtom(setHistoryWindowAtom);
  const setSelectedDate = useSetAtom(setSelectedHistoryDateAtom);

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>History</h2>
          <div className="storage-actions">
            <button className="ghost" onClick={() => setWindow("prev")} type="button">
              Previous 30 days
            </button>
            <button className="ghost" onClick={() => setWindow("next")} type="button">
              Next 30 days
            </button>
            <button className="ghost" onClick={() => setWindow("today")} type="button">
              Jump To Current
            </button>
          </div>
        </div>

        <p className="hint">
          Showing {range.startISO} to {range.endISO}
        </p>

        <div className="history-summary">
          <p>Days logged: {aggregate.days}</p>
          <p>Carbs: {aggregate.carbs.toFixed(1)} g</p>
          <p>Fat: {aggregate.fat.toFixed(1)} g</p>
          <p>Protein: {aggregate.protein.toFixed(1)} g</p>
        </div>

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
                  onClick={() =>
                    setSelectedDate(selected ? undefined : dateISO)
                  }
                  type="button"
                >
                  <strong>{dateISO}</strong>
                  <span>
                    Carbs {record.totals.carbs.toFixed(1)} / Fat {record.totals.fat.toFixed(1)} /
                    Protein {record.totals.protein.toFixed(1)}
                  </span>
                  <span>${formatPrice(record.priceLowerBound, record.hasUnknownPrice)}</span>
                </button>

                {selected && (
                  <div className="history-item__details">
                    <p>
                      Goal: Carbs {record.goalSnapshot.carbs.min}-{record.goalSnapshot.carbs.max} g,
                      Fat {record.goalSnapshot.fat.min}-{record.goalSnapshot.fat.max} g,
                      Protein {record.goalSnapshot.protein.min}-{record.goalSnapshot.protein.max} g
                    </p>
                    <p>Submitted: {new Date(record.submittedAtISO).toLocaleString()}</p>
                    <ul>
                      {record.items.map((item) => (
                        <li key={`${dateISO}-${item.foodId}`}>
                          {item.foodNameSnapshot}: {item.quantity} {item.unitSnapshot}
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

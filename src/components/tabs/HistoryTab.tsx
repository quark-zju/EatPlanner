import { useAtomValue } from "jotai";
import { formatPrice, formatQuantityWithUnit } from "../../core";
import {
  historyDaysInWindowAtom,
  historyWindowRangeAtom,
  selectedHistoryDateAtom,
} from "../../state/appAtoms";
import { setHistoryWindow, setSelectedHistoryDate } from "../../state/appDomainActions";
import { getFoodIcon } from "../../state/appState";
import { useTranslation } from "../../i18n";
import NutritionGoalCard from "../NutritionGoalCard";

export default function HistoryTab() {
  const t = useTranslation();
  const range = useAtomValue(historyWindowRangeAtom);
  const historyDays = useAtomValue(historyDaysInWindowAtom);
  const selectedHistoryDateISO = useAtomValue(selectedHistoryDateAtom);

  return (
    <>
      <section className="card">
        <div className="card__header">
          <h2>{t.history.History}</h2>
          <div className="storage-actions">
            <button className="ghost" onClick={() => setHistoryWindow("prev")} type="button">
              {t.history.Previous30Days}
            </button>
            <button className="ghost" onClick={() => setHistoryWindow("next")} type="button">
              {t.history.Next30Days}
            </button>
            <button className="ghost" onClick={() => setHistoryWindow("today")} type="button">
              {t.history.JumpToCurrent}
            </button>
          </div>
        </div>

        <p className="hint">
          {t.history.ShowingRange(range.startISO, range.endISO)}
        </p>

        {historyDays.length === 0 && (
          <p className="hint">{t.history.NoHistoryInWindow}</p>
        )}

        <div className="history-list">
          {historyDays.map(({ dateISO, record }) => {
            const selected = selectedHistoryDateISO === dateISO;
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
                      {headerItems.length === 0 && <span>{t.history.NoItems}</span>}
                    {headerItems.map((item) => (
                      <span
                        key={`${dateISO}-h-${item.foodId}`}
                        className="history-item__icon-chip"
                        title={`${item.foodNameSnapshot}: ${formatQuantityWithUnit(
                          item.quantity,
                          item.unitSnapshot
                        )}`}
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
                        <p>{t.history.Submitted}: {new Date(record.submittedAtISO).toLocaleString()}</p>
                        <ul>
                          {record.items.map((item) => (
                            <li key={`${dateISO}-${item.foodId}`}>
                              <span title={item.foodNameSnapshot}>
                                {getFoodIcon(item.foodIconSnapshot)}
                              </span>{" "}
                              {item.foodNameSnapshot}:{" "}
                              {formatQuantityWithUnit(item.quantity, item.unitSnapshot)}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <NutritionGoalCard
                        totals={record.totals}
                        goal={record.goalSnapshot}
                        title={t.history.GoalMatch}
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

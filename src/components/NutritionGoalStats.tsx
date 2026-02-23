import type { Goal, Nutrition } from "../core";

type NutritionGoalStatsProps = {
  totals: Nutrition;
  goal: Goal;
};

type MacroKey = "carbs" | "fat" | "protein";

const MACROS: MacroKey[] = ["carbs", "fat", "protein"];

const toLabel = (macro: MacroKey) =>
  macro === "carbs" ? "Carbs" : macro === "fat" ? "Fat" : "Protein";

const toPercent = (value: number, max: number) => Math.max(0, Math.min(100, (value / max) * 100));
const toInt = (value: number) => Math.round(value);

export default function NutritionGoalStats({ totals, goal }: NutritionGoalStatsProps) {
  return (
    <div className="nutrition-goals">
      {MACROS.map((macro) => {
        const current = totals[macro] ?? 0;
        const target = goal[macro];
        const scaleMax = Math.max(target.max * 1.2, current, 1);
        const currentPct = toPercent(current, scaleMax);
        const minPct = toPercent(target.min, scaleMax);
        const maxPct = toPercent(target.max, scaleMax);
        const isMet = current >= target.min && current <= target.max;

        return (
          <div className="nutrition-goal-row" key={macro}>
            <div className="nutrition-goal-row__header">
              <strong>{toLabel(macro)}</strong>
              <span>
                {toInt(current)}g / {toInt(target.min)}-{toInt(target.max)}g
              </span>
            </div>
            <div className="nutrition-goal-bar">
              <div
                className="nutrition-goal-bar__target"
                style={{
                  left: `${minPct}%`,
                  width: `${Math.max(0, maxPct - minPct)}%`,
                }}
              />
              <div
                className={`nutrition-goal-bar__value ${isMet ? "is-met" : ""}`}
                style={{ width: `${currentPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

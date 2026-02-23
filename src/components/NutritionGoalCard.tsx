import type { Goal, Nutrition } from "../core";
import NutritionGoalStats from "./NutritionGoalStats";

type NutritionGoalCardProps = {
  totals: Nutrition;
  goal: Goal;
  title?: string;
};

export default function NutritionGoalCard({
  totals,
  goal,
  title = "Goal Match",
}: NutritionGoalCardProps) {
  return (
    <div className="nutrition-goal-card">
      <h4>{title}</h4>
      <NutritionGoalStats totals={totals} goal={goal} />
    </div>
  );
}

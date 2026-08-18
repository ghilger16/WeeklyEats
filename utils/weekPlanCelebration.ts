import { Meal } from "../types/meals";
import { CurrentPlannedWeek, PLANNED_WEEK_ORDER } from "../types/weekPlan";
import { isSpecialMealId } from "../types/specialMeals";

export type WeekPlanCelebrationStat = {
  id: "familyStars" | "fiveStars" | "newMeals" | "effort" | "expense";
  icon: string;
  value: string;
  label: string;
};

export type WeekPlanCelebrationPayload = {
  dinnerCount: number;
  stats: WeekPlanCelebrationStat[];
  streakCount: number;
};

const hasFamilyStar = (meal: Meal) => {
  const ratings = Object.values(meal.familyRatings ?? {}).filter(
    (rating) => rating > 0,
  );
  return ratings.length > 0
    ? ratings.every((rating) => rating === 3)
    : (meal.rating ?? 0) >= 4.5;
};

const hasFiveStars = (meal: Meal) => (meal.rating ?? 0) >= 4.5;

const hasEnoughKnownValues = (knownCount: number, totalCount: number) =>
  knownCount >= Math.max(1, Math.ceil(totalCount / 2));

export const classifyWeekEffort = (values: number[]) => {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 1.5) return "Easy";
  if (average <= 2.35) return "Balanced";
  return "Cook-heavy";
};

export const classifyWeekExpense = (values: number[]) => {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 1.5) return "Budget-friendly";
  if (average <= 2.35) return "Balanced";
  return "Treat week";
};

export const buildWeekPlanCelebration = ({
  plan,
  meals,
  servedMealIds,
  streakCount,
  ratingStyle = "family",
}: {
  plan: CurrentPlannedWeek;
  meals: Meal[];
  servedMealIds: Set<string>;
  streakCount: number;
  ratingStyle?: "family" | "summary";
}): WeekPlanCelebrationPayload => {
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const plannedIds = PLANNED_WEEK_ORDER.map((day) => plan[day]).filter(
    (mealId): mealId is string => typeof mealId === "string",
  );
  const plannedMeals = plannedIds
    .filter((mealId) => !isSpecialMealId(mealId))
    .map((mealId) => mealById.get(mealId))
    .filter((meal): meal is Meal => Boolean(meal));

  const stats: WeekPlanCelebrationStat[] = [];
  const starCount = plannedMeals.filter(
    ratingStyle === "summary" ? hasFiveStars : hasFamilyStar,
  ).length;
  if (starCount > 0) {
    stats.push({
      id: ratingStyle === "summary" ? "fiveStars" : "familyStars",
      icon: "⭐",
      value: String(starCount),
      label:
        ratingStyle === "summary"
          ? starCount === 1
            ? "Five Star"
            : "Five Stars"
          : starCount === 1
            ? "Family Star"
            : "Family Stars",
    });
  }

  const newMealCount = plannedMeals.filter(
    (meal) => (meal.servedCount ?? 0) <= 0 && !servedMealIds.has(meal.id),
  ).length;
  if (newMealCount > 0) {
    stats.push({
      id: "newMeals",
      icon: "🆕",
      value: String(newMealCount),
      label: newMealCount === 1 ? "New Meal" : "New Meals",
    });
  }

  const difficulties = plannedMeals
    .map((meal) => meal.difficulty)
    .filter((value): value is number => typeof value === "number");
  if (hasEnoughKnownValues(difficulties.length, plannedMeals.length)) {
    const effort = classifyWeekEffort(difficulties);
    if (effort) {
      stats.push({
        id: "effort",
        icon: "⚡",
        value: effort === "Cook-heavy" ? "Cook-Heavy" : effort,
        label: "Week",
      });
    }
  }

  const expenses = plannedMeals
    .map((meal) => meal.expense)
    .filter((value): value is number => typeof value === "number");
  if (hasEnoughKnownValues(expenses.length, plannedMeals.length)) {
    const expense = classifyWeekExpense(expenses);
    if (expense) {
      const display =
        expense === "Budget-friendly"
          ? { value: "Budget", label: "Friendly" }
          : expense === "Balanced"
            ? { value: "Balanced", label: "Spend" }
            : { value: "Treat", label: "Week" };
      stats.push({
        id: "expense",
        icon: "💰",
        ...display,
      });
    }
  }

  return {
    dinnerCount: plannedIds.length,
    stats: stats.slice(0, 4),
    streakCount,
  };
};

export const WEEK_PLAN_STREAK_MILESTONES: Record<
  number,
  { title: string; message: string }
> = {
  5: { title: "5 weeks in a row!", message: "Your planning rhythm is taking shape." },
  10: { title: "10 weeks in a row!", message: "Dinner planning is officially a habit." },
  25: { title: "25 weeks in a row!", message: "You’ve made planning ahead second nature." },
  50: { title: "50 weeks in a row!", message: "An incredible year of calmer dinner planning." },
};

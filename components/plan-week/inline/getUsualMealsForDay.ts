import { ServedMealEntry } from "../../../stores/servedMealsStorage";
import { WeekPlanHistoryEntry } from "../../../stores/weekPlanStorage";
import { Meal } from "../../../types/meals";
import { PlannedWeekDayKey } from "../../../types/weekPlan";
import { isSpecialMealId } from "../../../types/specialMeals";

const MAX_USUAL_MEALS = 5;
const MAX_RECENT_COMPLETED_WEEKS = 4;

export const getRecentCompletedWeekMealsForDay = (
  day: PlannedWeekDayKey,
  meals: Meal[],
  completedWeeks: WeekPlanHistoryEntry[],
): Meal[] => {
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const seen = new Set<Meal["id"]>();

  return [...completedWeeks]
    .sort(
      (left, right) =>
        new Date(right.weekStartISO).getTime() -
        new Date(left.weekStartISO).getTime(),
    )
    .slice(0, MAX_RECENT_COMPLETED_WEEKS)
    .map((entry) => entry.plan[day])
    .filter((mealId): mealId is string => Boolean(mealId))
    .map((mealId) => mealById.get(mealId))
    .filter((meal): meal is Meal => {
      if (!meal || isSpecialMealId(meal.id) || seen.has(meal.id)) return false;
      seen.add(meal.id);
      return true;
    })
    .slice(0, MAX_RECENT_COMPLETED_WEEKS);
};

export const getUsualMealsForDay = (
  day: PlannedWeekDayKey,
  meals: Meal[],
  history: ServedMealEntry[],
): Meal[] => {
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const weekdayStats = new Map<string, { count: number; latest: number }>();

  history.forEach((entry) => {
    if (
      entry.dayKey !== day ||
      entry.outcome !== "served" ||
      !entry.mealId ||
      !mealById.has(entry.mealId)
    ) {
      return;
    }
    const current = weekdayStats.get(entry.mealId) ?? { count: 0, latest: 0 };
    weekdayStats.set(entry.mealId, {
      count: current.count + 1,
      latest: Math.max(current.latest, new Date(entry.servedAtISO).getTime() || 0),
    });
  });

  const weekdayMeals = [...weekdayStats.entries()]
    .sort(([, left], [, right]) =>
      right.count === left.count ? right.latest - left.latest : right.count - left.count,
    )
    .map(([mealId]) => mealById.get(mealId))
    .filter((meal): meal is Meal => Boolean(meal));

  const seen = new Set(weekdayMeals.map((meal) => meal.id));
  const fallbackMeals = meals
    .filter((meal) => !isSpecialMealId(meal.id) && !seen.has(meal.id))
    .sort((left, right) => {
      if (left.isFavorite !== right.isFavorite) return left.isFavorite ? -1 : 1;
      if ((right.rating ?? 0) !== (left.rating ?? 0)) return (right.rating ?? 0) - (left.rating ?? 0);
      return 0;
    });

  return [...weekdayMeals, ...fallbackMeals].slice(0, MAX_USUAL_MEALS);
};

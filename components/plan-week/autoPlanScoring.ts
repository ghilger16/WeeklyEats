import { getExpenseTier } from "./suggestions/suggestionMatcher";
import { Meal } from "../../types/meals";
import { CuisineType, isCuisineType } from "../../types/cuisine";
import { PlannedWeekDayKey } from "../../types/weekPlan";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { getIngredientOverlap } from "../../utils/ingredientOverlap";
import { DAY_MS, getDaysSinceServed } from "../../utils/servingHistory";

export const getRecencyScore = (lastServed: number | undefined, now = Date.now()) => {
  const days = getDaysSinceServed(lastServed, now);
  return days === null ? 14 : Math.min(days / 14, 12);
};

export const getSharedIngredientBonus = (meal: Meal, selected: Meal[]) =>
  Math.min(4, getIngredientOverlap(meal, selected).sharedCount);

/** Last eight logged occurrences within eight weeks; unknown cuisines dilute confidence. */
export const getWeekdayCuisineAffinity = (
  day: PlannedWeekDayKey,
  cuisine: CuisineType | null | undefined,
  meals: Meal[],
  history: ServedMealEntry[],
  now = Date.now(),
): number => {
  if (!isCuisineType(cuisine) || cuisine === "other") return 0;
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const dates = new Set<string>();
  const recent = history
    .filter((entry) => {
      const timestamp = Date.parse(entry.servedAtISO);
      return entry.outcome === "served" && entry.dayKey === day && entry.mealId &&
        Number.isFinite(timestamp) && timestamp <= now && timestamp >= now - 56 * DAY_MS;
    })
    .sort((a, b) => Date.parse(b.servedAtISO) - Date.parse(a.servedAtISO))
    .filter((entry) => {
      const date = new Date(entry.servedAtISO).toDateString();
      if (dates.has(date)) return false;
      dates.add(date);
      return true;
    })
    .slice(0, 8);
  let matchingWeight = 0;
  let totalWeight = 0;
  recent.forEach((entry) => {
    // Four-week half-life, based on elapsed time rather than gaps in logging.
    const weight = 2 ** (-(now - Date.parse(entry.servedAtISO)) / (28 * DAY_MS));
    totalWeight += weight;
    if (mealById.get(entry.mealId!)?.cuisine === cuisine) matchingWeight += weight;
  });
  if (!totalWeight) return 0;
  const consistency = matchingWeight / totalWeight;
  return Math.min(8, matchingWeight * 2.5 * consistency);
};

/** Inspectable per-day signals, without exposing scoring details in the planner UI. */
export type AutoPlanScoreBreakdown = {
  settings: number;
  rating: number;
  repeatTiming: number;
  recency: number;
  weekdayCuisine: number;
  ingredientOverlap: number;
  previousAttempt: number;
  total: number;
};

/** Small, bounded adjustment across valid candidates; never changes day eligibility. */
export const getWholeWeekPenalty = (
  days: { meal: Meal; effortSpecified: boolean; expenseSpecified: boolean }[],
): number => {
  const cuisines = new Map<string, number>();
  let hard = 0;
  let expensive = 0;
  days.forEach(({ meal, effortSpecified, expenseSpecified }) => {
    if (isCuisineType(meal.cuisine) && meal.cuisine !== "other") {
      cuisines.set(meal.cuisine, (cuisines.get(meal.cuisine) ?? 0) + 1);
    }
    if (!effortSpecified && (meal.difficulty ?? 0) >= 4) hard++;
    const tier = getExpenseTier(meal);
    if (!expenseSpecified && tier === 3) expensive++;
  });
  const repeatedCuisine = [...cuisines.values()].reduce((sum, count) => sum + Math.max(0, count - 3) * 2, 0);
  return Math.min(8, repeatedCuisine + Math.max(0, hard - 2) * 2 + Math.max(0, expensive - 2));
};

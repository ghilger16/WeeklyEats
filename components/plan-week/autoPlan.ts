import { getLatestServedDates } from "../../utils/servingHistory";
import { AutoPlanScoreBreakdown, getRecencyScore, getSharedIngredientBonus, getWeekdayCuisineAffinity, getWholeWeekPenalty } from "./autoPlanScoring";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { Meal } from "../../types/meals";
import { DayPinsPerWeek, normalizeDayPinsState } from "../../types/dayPins";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import { buildMealSuggestions } from "./suggestions/suggestionMatcher";

type AutoPlanArgs = {
  days: PlannedWeekDayKey[];
  meals: Meal[];
  plannedWeek: CurrentPlannedWeek;
  dayPinsMap: DayPinsPerWeek;
  servedEntries: ServedMealEntry[];
  previousGeneratedMealIds?: Set<string>;
  /** Inject a seeded RNG in tests; production varies exact ties only. */
  random?: () => number;
  now?: number;
};

export type AutoPlanAssignment = {
  day: PlannedWeekDayKey;
  meal: Meal;
  side?: string;
  scoreBreakdown: AutoPlanScoreBreakdown;
};

const getFirstPreferredSide = (meal: Meal) =>
  meal.preferredSides
    ?.map((side) => side.trim())
    .find(Boolean);

const buildCandidateAutoPlan = ({
  days,
  meals,
  plannedWeek,
  dayPinsMap,
  servedEntries,
  previousGeneratedMealIds = new Set(),
  random = Math.random,
  now = Date.now(),
}: AutoPlanArgs): AutoPlanAssignment[] => {
  const latestServed = getLatestServedDates(servedEntries, now);

  const occupiedMealIds = new Set<string>();
  const selectedMeals: Meal[] = [];
  PLANNED_WEEK_ORDER.forEach((day) => {
    const mealId = plannedWeek[day];
    if (!mealId) return;
    occupiedMealIds.add(mealId);
    const meal = meals.find((candidate) => candidate.id === mealId);
    if (meal) selectedMeals.push(meal);
  });

  const unplannedDays = days.filter((day) => !plannedWeek[day]);
  const assignments: AutoPlanAssignment[] = [];

  unplannedDays.forEach((day) => {
    const cuisineScores = new Map<Meal["cuisine"], number>();
    const cuisineScore = (meal: Meal) => {
      if (!cuisineScores.has(meal.cuisine)) {
        cuisineScores.set(meal.cuisine, getWeekdayCuisineAffinity(day, meal.cuisine, meals, servedEntries, now));
      }
      return cuisineScores.get(meal.cuisine)!;
    };
    const ranked = buildMealSuggestions(
      meals,
      normalizeDayPinsState(dayPinsMap[day]),
      occupiedMealIds,
      servedEntries,
      now,
    )
      .map((suggestion) => {
        const meal = suggestion.meal;
        const breakdown = {
          ...suggestion.breakdown,
          recency: getRecencyScore(latestServed.get(meal.id), now),
          weekdayCuisine: cuisineScore(meal),
          ingredientOverlap: getSharedIngredientBonus(meal, selectedMeals),
          previousAttempt: previousGeneratedMealIds.has(meal.id) ? -30 : 0,
        };
        const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
        return { meal, scoreBreakdown: { ...breakdown, total }, tieBreak: random() };
      })
      .sort((left, right) => right.scoreBreakdown.total - left.scoreBreakdown.total || right.tieBreak - left.tieBreak);

    const choice = ranked[0]?.meal;
    if (!choice) return;
    assignments.push({
      day,
      meal: choice,
      side: getFirstPreferredSide(choice),
      scoreBreakdown: ranked[0].scoreBreakdown,
    });
    occupiedMealIds.add(choice.id);
    selectedMeals.push(choice);
  });

  return assignments;
};

/** Try three greedy plans. Randomness only changes exact ties within each candidate. */
export const buildAutoPlan = (args: AutoPlanArgs): AutoPlanAssignment[] => {
  const now = args.now ?? Date.now();
  let best: AutoPlanAssignment[] = [];
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = buildCandidateAutoPlan({ ...args, now });
    const assigned = new Map(candidate.map((entry) => [entry.day, entry.meal]));
    const week = PLANNED_WEEK_ORDER.flatMap((day) => {
      const meal = assigned.get(day) ?? args.meals.find((entry) => entry.id === args.plannedWeek[day]);
      const pins = normalizeDayPinsState(args.dayPinsMap[day]);
      return meal ? [{ meal, effortSpecified: Boolean(pins.effort), expenseSpecified: Boolean(pins.expense) }] : [];
    });
    const score = candidate.reduce((sum, entry) => sum + entry.scoreBreakdown.total, 0) - getWholeWeekPenalty(week);
    // Filling available days takes priority over a higher-scoring partial week.
    if (candidate.length > best.length || (candidate.length === best.length && score > bestScore)) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

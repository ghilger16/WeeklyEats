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
};

export type AutoPlanAssignment = {
  day: PlannedWeekDayKey;
  meal: Meal;
  side?: string;
};

const getFirstPreferredSide = (meal: Meal) =>
  meal.preferredSides
    ?.map((side) => side.trim())
    .find(Boolean);

const getIngredientKeys = (meal: Meal) =>
  new Set(
    (meal.ingredients ?? [])
      .map((ingredient) =>
        typeof ingredient === "string" ? ingredient : ingredient.name,
      )
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );

const isFamilyFavorite = (meal: Meal) => {
  const ratings = Object.values(meal.familyRatings ?? {}).filter(
    (rating) => rating > 0,
  );
  return ratings.length > 0 && ratings.every((rating) => rating === 3);
};

export const buildAutoPlan = ({
  days,
  meals,
  plannedWeek,
  dayPinsMap,
  servedEntries,
  previousGeneratedMealIds = new Set(),
}: AutoPlanArgs): AutoPlanAssignment[] => {
  const latestServed = new Map<string, number>();
  servedEntries.forEach((entry) => {
    if (entry.outcome !== "served" || !entry.mealId) return;
    const servedAt = new Date(entry.servedAtISO).getTime();
    if (!Number.isFinite(servedAt)) return;
    latestServed.set(
      entry.mealId,
      Math.max(latestServed.get(entry.mealId) ?? 0, servedAt),
    );
  });

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

  unplannedDays.forEach((day, dayIndex) => {
    const ranked = buildMealSuggestions(
      meals,
      normalizeDayPinsState(dayPinsMap[day]),
      occupiedMealIds,
    )
      .map((suggestion) => {
        const meal = suggestion.meal;
        let score = suggestion.score;
        const lastServed = latestServed.get(meal.id);
        if (!lastServed) score += 14;
        else {
          const daysSince = Math.max(0, (Date.now() - lastServed) / 86400000);
          score += Math.min(daysSince / 14, 12);
        }
        if (isFamilyFavorite(meal)) score += 12;
        if (dayIndex < 5 && typeof meal.difficulty === "number" && meal.difficulty <= 2) {
          score += 4;
        }
        if (previousGeneratedMealIds.has(meal.id)) score -= 30;

        const ingredientKeys = getIngredientKeys(meal);
        const overlap = selectedMeals.reduce((total, selected) => {
          const selectedKeys = getIngredientKeys(selected);
          return total + [...ingredientKeys].filter((key) => selectedKeys.has(key)).length;
        }, 0);
        score -= overlap * 2;
        return { meal, score };
      })
      .sort((left, right) => right.score - left.score || left.meal.title.localeCompare(right.meal.title));

    const choice = ranked[0]?.meal;
    if (!choice) return;
    assignments.push({
      day,
      meal: choice,
      side: getFirstPreferredSide(choice),
    });
    occupiedMealIds.add(choice.id);
    selectedMeals.push(choice);
  });

  return assignments;
};

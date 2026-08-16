import { ServedMealEntry } from "../stores/servedMealsStorage";
import { Meal } from "../types/meals";

export type SmartLevel = 1 | 2 | 3 | 4 | 5;

type SmartLevelInput = {
  meals: Meal[];
  servedEntries: ServedMealEntry[];
  plannedWeeksCount: number;
};

const hasRating = (meal: Meal) =>
  (meal.rating ?? 0) > 0 ||
  Object.values(meal.familyRatings ?? {}).some((rating) => rating > 0);

const hasPlanningDetails = (meal: Meal) =>
  Boolean(meal.cuisine) ||
  typeof meal.difficulty === "number" ||
  typeof meal.expense === "number";

const hasCompletePlanningProfile = (meal: Meal) =>
  Boolean(meal.cuisine) &&
  typeof meal.difficulty === "number" &&
  typeof meal.expense === "number";

export const getSmartLevel = ({
  meals,
  servedEntries,
  plannedWeeksCount,
}: SmartLevelInput): SmartLevel => {
  const servedCount = servedEntries.filter(
    (entry) => entry.outcome === "served",
  ).length;
  const ratedMeals = meals.filter(hasRating).length;
  const detailedMeals = meals.filter(hasPlanningDetails).length;
  const completeProfiles = meals.filter(hasCompletePlanningProfile).length;
  const freezerMeals = meals.filter(
    (meal) =>
      meal.freezerAmount?.trim() ||
      meal.freezerQuantity?.trim() ||
      meal.freezerAddedAt,
  ).length;

  if (
    plannedWeeksCount >= 8 &&
    servedCount >= 25 &&
    ratedMeals >= 8 &&
    completeProfiles >= 8
  ) return 5;

  if (
    plannedWeeksCount >= 3 &&
    servedCount >= 10 &&
    ratedMeals >= 4 &&
    completeProfiles >= 3 &&
    (freezerMeals > 0 || completeProfiles >= 5)
  ) return 4;

  if (servedCount >= 5 && ratedMeals >= 3 && plannedWeeksCount >= 1) return 3;

  if (
    meals.length > 0 &&
    detailedMeals > 0 &&
    (plannedWeeksCount > 0 || servedCount > 0)
  ) return 2;

  return 1;
};


import { Meal } from "../types/meals";
import { getFamilyRatingSummary } from "./familyRatings";

export const GALAXY_MEAL_MINIMUM_SERVINGS = 5;

const getRecency = (meal: Meal) => {
  const value = meal.updatedAt ?? meal.createdAt;
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getGalaxyMealId = (
  meals: Meal[],
  memberIds: string[]
): string | null => {
  if (memberIds.length <= 1) return null;

  const eligibleMeals = meals.filter(
    (meal) =>
      (meal.servedCount ?? 0) >= GALAXY_MEAL_MINIMUM_SERVINGS &&
      getFamilyRatingSummary(meal.familyRatings, memberIds)?.isUnanimousHeart ===
        true
  );

  if (!eligibleMeals.length) return null;

  return [...eligibleMeals].sort((a, b) => {
    const servedDelta = (b.servedCount ?? 0) - (a.servedCount ?? 0);
    if (servedDelta !== 0) return servedDelta;
    const recencyDelta = getRecency(b) - getRecency(a);
    if (recencyDelta !== 0) return recencyDelta;
    return a.title.localeCompare(b.title);
  })[0].id;
};

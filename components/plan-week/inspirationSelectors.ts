import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { Meal } from "../../types/meals";
import { CuisineType } from "../../types/cuisine";

export const getBeenAwhileMeals = (
  meals: Meal[],
  history: ServedMealEntry[],
  minimumWeeks?: number,
  now = Date.now(),
): Meal[] => {
  const latestServed = new Map<string, number>();
  history.forEach((entry) => {
    if (entry.outcome !== "served" || !entry.mealId) return;
    const servedAt = new Date(entry.servedAtISO).getTime();
    if (!Number.isFinite(servedAt)) return;
    latestServed.set(
      entry.mealId,
      Math.max(latestServed.get(entry.mealId) ?? 0, servedAt),
    );
  });
  return [...meals]
    .filter((meal) => {
      if (minimumWeeks === undefined) return true;
      const lastServedAt = latestServed.get(meal.id);
      const createdAt = meal.createdAt
        ? new Date(meal.createdAt).getTime()
        : NaN;
      const referenceTime = lastServedAt ?? createdAt;
      return (
        Number.isFinite(referenceTime) &&
        now - referenceTime >= minimumWeeks * 7 * 24 * 60 * 60 * 1000
      );
    })
    .sort((left, right) => {
      const leftCreatedAt = new Date(left.createdAt ?? "").getTime();
      const rightCreatedAt = new Date(right.createdAt ?? "").getTime();
      const leftReference =
        latestServed.get(left.id) ??
        (Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0);
      const rightReference =
        latestServed.get(right.id) ??
        (Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0);
      return leftReference - rightReference;
    });
};

export const getRecentlyAddedUnservedMeals = (
  meals: Meal[],
  history: ServedMealEntry[],
  now = Date.now(),
): Meal[] => {
  const servedMealIds = new Set(
    history
      .filter((entry) => entry.outcome === "served" && Boolean(entry.mealId))
      .map((entry) => entry.mealId as string),
  );
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;

  return meals
    .filter((meal) => {
      if (servedMealIds.has(meal.id) || (meal.servedCount ?? 0) > 0) {
        return false;
      }
      const createdAt = meal.createdAt ? new Date(meal.createdAt).getTime() : NaN;
      return Number.isFinite(createdAt) && createdAt >= cutoff && createdAt <= now;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt as string).getTime() -
        new Date(left.createdAt as string).getTime(),
    );
};

export const getFamilyStarMeals = (
  meals: Meal[],
  isFamilyStar: (meal: Meal) => boolean,
) => meals.filter(isFamilyStar);

export const getFreezerMeals = (
  meals: Meal[],
  hasFreezerInventory: (meal: Meal) => boolean,
) => meals.filter(hasFreezerInventory);

export const getEasyMeals = (meals: Meal[]) =>
  meals.filter(
    (meal) => typeof meal.difficulty === "number" && meal.difficulty <= 2,
  );

export const getCuisineMeals = (meals: Meal[], cuisine?: CuisineType) =>
  meals.filter(
    (meal) => Boolean(meal.cuisine) && (!cuisine || meal.cuisine === cuisine),
  );

const expenseValue = (meal: Meal) => meal.expense ?? meal.plannedCostTier ?? 3;

export const getBudgetMeals = (meals: Meal[]) =>
  meals
    .filter((meal) => expenseValue(meal) <= 2)
    .sort((left, right) => expenseValue(left) - expenseValue(right));

import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { Meal } from "../../types/meals";

export const getBeenAwhileMeals = (
  meals: Meal[],
  history: ServedMealEntry[],
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
  return [...meals].sort(
    (left, right) =>
      (latestServed.get(left.id) ?? 0) - (latestServed.get(right.id) ?? 0),
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

const expenseValue = (meal: Meal) => meal.expense ?? meal.plannedCostTier ?? 3;

export const getBudgetMeals = (meals: Meal[]) =>
  meals
    .filter((meal) => expenseValue(meal) <= 2)
    .sort((left, right) => expenseValue(left) - expenseValue(right));

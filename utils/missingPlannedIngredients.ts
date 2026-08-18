import type { WeekPlanDay } from "../hooks/useCurrentWeekPlan";
import type { Meal, MealIngredient } from "../types/meals";
import { isSpecialMealId } from "../types/specialMeals";

const hasIngredientName = (ingredient: MealIngredient) =>
  typeof ingredient === "string"
    ? Boolean(ingredient.trim())
    : Boolean(ingredient.name.trim());

export const mealHasIngredientInformation = (meal: Meal) =>
  (meal.ingredients ?? []).some(hasIngredientName);

export const getPlannedMealsMissingIngredients = (days: WeekPlanDay[]) => {
  const seen = new Set<string>();
  return days.flatMap((day) => {
    if (
      !day.mealId ||
      !day.meal ||
      isSpecialMealId(day.mealId) ||
      mealHasIngredientInformation(day.meal) ||
      seen.has(day.meal.id)
    ) {
      return [];
    }
    seen.add(day.meal.id);
    return [day.meal];
  });
};

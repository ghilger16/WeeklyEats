import { getPlannedMealsMissingIngredients } from "../missingPlannedIngredients";
import type { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import type { Meal } from "../../types/meals";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";

const meal = (id: string, ingredients?: Meal["ingredients"]): Meal => ({
  id,
  title: id,
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  ingredients,
});

const day = (
  key: WeekPlanDay["key"],
  mealId: string | null,
  plannedMeal?: Meal,
): WeekPlanDay => ({
  key,
  label: key.slice(0, 3).toUpperCase(),
  displayName: key,
  plannedDate: new Date("2026-08-17T12:00:00Z"),
  plannedDateISO: "2026-08-17",
  status: "upcoming",
  mealId,
  meal: plannedMeal,
  sides: [],
});

describe("planned meals missing ingredients", () => {
  it("returns actual empty meals in day order and excludes special states", () => {
    const empty = meal("empty");
    const pantryOnly = meal("pantry", [
      { name: "Salt", category: "spices", ingredientType: "pantryStaple" },
    ]);

    expect(
      getPlannedMealsMissingIngredients([
        day("mon", "empty", empty),
        day("tue", EAT_OUT_MEAL_ID, EAT_OUT_MEAL),
        day("wed", null),
        day("thu", "pantry", pantryOnly),
        day("fri", "empty", empty),
      ]).map((entry) => entry.id),
    ).toEqual(["empty"]);
  });
});

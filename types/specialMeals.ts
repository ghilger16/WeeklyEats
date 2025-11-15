import { Meal } from "./meals";

export const EAT_OUT_MEAL_ID = "__eat_out__";

export const EAT_OUT_MEAL: Meal = {
  id: EAT_OUT_MEAL_ID,
  title: "Eat Out Night",
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 1,
  locked: false,
  isFavorite: false,
};

export const isEatOutMealId = (id?: string | null): boolean =>
  Boolean(id) && id === EAT_OUT_MEAL_ID;

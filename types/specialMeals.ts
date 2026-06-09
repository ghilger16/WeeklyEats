import { Meal } from "./meals";

export const EAT_OUT_MEAL_ID = "__eat_out__";
export const FLEX_NIGHT_MEAL_ID = "__flex_night__";

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

export const FLEX_NIGHT_MEAL: Meal = {
  id: FLEX_NIGHT_MEAL_ID,
  title: "Flex Night",
  emoji: "🔄",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 1,
  locked: false,
  isFavorite: false,
};

export const isEatOutMealId = (id?: string | null): boolean =>
  Boolean(id) && id === EAT_OUT_MEAL_ID;

export const isFlexNightMealId = (id?: string | null): boolean =>
  Boolean(id) && id === FLEX_NIGHT_MEAL_ID;

export const isSpecialMealId = (id?: string | null): boolean =>
  isEatOutMealId(id) || isFlexNightMealId(id);

export const getSpecialMealById = (
  id?: string | null,
  title?: string | null
): Meal | undefined => {
  const customTitle = title?.trim();
  if (isEatOutMealId(id)) {
    return customTitle ? { ...EAT_OUT_MEAL, title: customTitle } : EAT_OUT_MEAL;
  }
  if (isFlexNightMealId(id)) {
    return FLEX_NIGHT_MEAL;
  }
  return undefined;
};

import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { EAT_OUT_MEAL_ID, FLEX_NIGHT_MEAL_ID } from "../../types/specialMeals";

export const selectShareWeek = (current: WeekPlanDay[], next: WeekPlanDay[]) =>
  current.some(day => day.meal) ? current : next.some(day => day.meal) ? next : [];

export const shareDayDetails = (day: WeekPlanDay) => {
  const eatOut = day.mealId === EAT_OUT_MEAL_ID;
  const flex = day.mealId === FLEX_NIGHT_MEAL_ID;
  return {
    title: eatOut ? "Eat Out" : flex ? "Flex Night" : day.meal?.title ?? "Unplanned",
    subtitle: eatOut
      ? day.meal?.title !== "Eat Out Night" && day.meal?.title !== "Eat Out" ? day.meal?.title ?? "" : ""
      : day.sides.join(" · "),
    symbol: eatOut ? "silverware-fork-knife" : flex ? "sync" : undefined,
  };
};

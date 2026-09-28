import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { EAT_OUT_MEAL_ID, FLEX_NIGHT_MEAL_ID } from "../../types/specialMeals";

export type ShareWeekSelection = {
  currentCompleted?: boolean;
  currentPlannedAt?: string;
  nextPlannedAt?: string;
};

export const getShareWeekOrder = (current: WeekPlanDay[], next: WeekPlanDay[], options: ShareWeekSelection = {}) => {
  const timestamp = (iso?: string) => Date.parse(iso ?? "") || 0;
  const order: ("current" | "next")[] = timestamp(options.currentPlannedAt) > timestamp(options.nextPlannedAt)
    ? ["current", "next"] : ["next", "current"];
  return order.filter(week => week === "current"
    ? !options.currentCompleted && current.some(day => day.meal)
    : next.some(day => day.meal));
};

export const selectShareWeek = (current: WeekPlanDay[], next: WeekPlanDay[], options: ShareWeekSelection = {}) => {
  const first = getShareWeekOrder(current, next, options)[0];
  return first === "current" ? current : first === "next" ? next : [];
};

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

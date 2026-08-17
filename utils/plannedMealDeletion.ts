import { getCurrentWeekPlan } from "../stores/weekPlanStorage";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PlannedWeekDayKey,
} from "../types/weekPlan";
import {
  getNextWeekStartForDate,
  getWeekStartForDate,
} from "./weekDays";

export type ActivePlanScope = "current" | "next";

export type PlannedMealOccurrence = {
  scope: ActivePlanScope;
  weekStartISO: string;
  dayKey: PlannedWeekDayKey;
  dayLabel: string;
};

const toISO = (date: Date) => date.toISOString().slice(0, 10);

export const getActivePlannedMealOccurrences = async ({
  mealId,
  startDay,
  orderedDays,
  referenceDate = new Date(),
}: {
  mealId: string;
  startDay: PlannedWeekDayKey;
  orderedDays: PlannedWeekDayKey[];
  referenceDate?: Date;
}): Promise<PlannedMealOccurrence[]> => {
  const currentWeekStartISO = toISO(
    getWeekStartForDate(startDay, referenceDate),
  );
  const nextWeekStartISO = toISO(
    getNextWeekStartForDate(startDay, referenceDate),
  );
  const [currentPlan, nextPlan] = await Promise.all([
    getCurrentWeekPlan(currentWeekStartISO),
    getCurrentWeekPlan(nextWeekStartISO),
  ]);

  return ([
    ["current", currentWeekStartISO, currentPlan],
    ["next", nextWeekStartISO, nextPlan],
  ] as const).flatMap(([scope, weekStartISO, plan]) =>
    orderedDays
      .filter((dayKey) => plan[dayKey] === mealId)
      .map((dayKey) => ({
        scope,
        weekStartISO,
        dayKey,
        dayLabel: PLANNED_WEEK_DISPLAY_NAMES[dayKey],
      })),
  );
};

import { PLANNED_WEEK_ORDER, PlannedWeekDayKey } from "../../types/weekPlan";
import {
  DayPinsPerWeek,
  DayPinsState,
  createEmptyDayPinsMap,
  normalizeDayPinsState,
} from "../../types/dayPins";

export type WeeklyWeekSettings = {
  mood: "low_effort" | "balanced" | "motivated";
  reuseWindowWeeks: 1 | 2 | 3 | null;
  // Future fields (dietary filters, etc.) can be added here later.
};

const difficultyOrder: Record<
  WeeklyWeekSettings["mood"],
  Record<PlannedWeekDayKey, DayPinsState["effort"]>
> = {
  low_effort: PLANNED_WEEK_ORDER.reduce(
    (acc, key) => ({ ...acc, [key]: "easy" }),
    {} as Record<PlannedWeekDayKey, DayPinsState["effort"]>
  ),
  balanced: PLANNED_WEEK_ORDER.reduce((acc, key, index) => {
    acc[key] = index < 4 ? "easy" : "medium";
    return acc;
  }, {} as Record<PlannedWeekDayKey, DayPinsState["effort"]>),
  motivated: PLANNED_WEEK_ORDER.reduce((acc, key, index) => {
    acc[key] = index < 4 ? "medium" : index === 6 ? "hard" : "medium";
    return acc;
  }, {} as Record<PlannedWeekDayKey, DayPinsState["effort"]>),
};

export const deriveWeekPinsFromSettings = (
  settings: WeeklyWeekSettings
): DayPinsPerWeek => {
  const base = createEmptyDayPinsMap();
  const pattern = difficultyOrder[settings.mood ?? "balanced"];
  PLANNED_WEEK_ORDER.forEach((dayKey) => {
    base[dayKey] = normalizeDayPinsState({
      ...base[dayKey],
      effort: pattern[dayKey] ?? "easy",
      reuseWeeks: settings.reuseWindowWeeks ?? null,
    });
  });
  return base;
};

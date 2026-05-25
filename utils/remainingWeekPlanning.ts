import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../types/weekPlan";
import { WEEK_DAY_TO_INDEX, startOfDay } from "./weekDays";

const getDayKeyForDate = (date: Date): PlannedWeekDayKey =>
  PLANNED_WEEK_ORDER.find((day) => WEEK_DAY_TO_INDEX[day] === date.getDay()) ??
  "mon";

export const getRemainingPlanningDays = (
  resetDay: PlannedWeekDayKey,
  today: Date = new Date()
): PlannedWeekDayKey[] => {
  const todayKey = getDayKeyForDate(startOfDay(today));
  const todayIndex = WEEK_DAY_TO_INDEX[todayKey];
  const resetIndex = WEEK_DAY_TO_INDEX[resetDay];

  if (todayIndex >= resetIndex) {
    return [];
  }

  return PLANNED_WEEK_ORDER.filter((day) => {
    const dayIndex = WEEK_DAY_TO_INDEX[day];
    return dayIndex >= todayIndex && dayIndex < resetIndex;
  });
};

export const formatPlanningDayRange = (days: PlannedWeekDayKey[]): string => {
  if (days.length === 0) {
    return "";
  }
  if (days.length === 1) {
    return PLANNED_WEEK_DISPLAY_NAMES[days[0]];
  }
  return `${PLANNED_WEEK_DISPLAY_NAMES[days[0]]}-${PLANNED_WEEK_DISPLAY_NAMES[days[days.length - 1]]}`;
};

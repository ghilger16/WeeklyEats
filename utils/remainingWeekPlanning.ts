import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../types/weekPlan";
import { WEEK_DAY_TO_INDEX, startOfDay } from "./weekDays";

const getDayKeyForDate = (date: Date): PlannedWeekDayKey =>
  PLANNED_WEEK_ORDER.find((day) => WEEK_DAY_TO_INDEX[day] === date.getDay()) ??
  "mon";

const rotateWeekOrder = (startDay: PlannedWeekDayKey): PlannedWeekDayKey[] => {
  const startIndex = PLANNED_WEEK_ORDER.indexOf(startDay);
  if (startIndex === -1) {
    return PLANNED_WEEK_ORDER;
  }
  return [
    ...PLANNED_WEEK_ORDER.slice(startIndex),
    ...PLANNED_WEEK_ORDER.slice(0, startIndex),
  ];
};

export const getRemainingPlanningDays = (
  resetDay: PlannedWeekDayKey,
  today: Date = new Date()
): PlannedWeekDayKey[] => {
  const todayKey = getDayKeyForDate(startOfDay(today));
  const orderedWeek = rotateWeekOrder(resetDay);
  const todayIndex = orderedWeek.indexOf(todayKey);
  if (todayIndex === -1) {
    return [];
  }

  return orderedWeek.slice(todayIndex);
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

import { PlannedWeekDayKey } from "../types/weekPlan";

export const WEEK_DAY_TO_INDEX: Record<PlannedWeekDayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const getWeekStartForDate = (
  startDay: PlannedWeekDayKey,
  date: Date = new Date()
): Date => {
  const start = startOfDay(date);
  const day = start.getDay();
  const targetIndex = WEEK_DAY_TO_INDEX[startDay];
  const diff = (day + 7 - targetIndex) % 7;
  start.setDate(start.getDate() - diff);
  return start;
};

export const getNextWeekStartForDate = (
  startDay: PlannedWeekDayKey,
  date: Date = new Date()
): Date => {
  const currentWeekStart = getWeekStartForDate(startDay, date);
  return addDays(currentWeekStart, 7);
};

export const formatWeekdayDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

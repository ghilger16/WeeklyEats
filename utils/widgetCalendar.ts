import { PlannedWeekDayKey } from "../types/weekPlan";
import { addDays, WEEK_DAY_TO_INDEX } from "./weekDays";

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parseLocalDate = (key: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateKey(date) === key ? date : null;
};

// Legacy week IDs truncated local midnight to a UTC date. East of UTC, that
// can be the preceding calendar day. New writes preserve the resolved local date.
export const resolvePlanWeekDate = (weekId: string, startDay: PlannedWeekDayKey, explicitDate?: string) => {
  const date = parseLocalDate(weekId.slice(0, 10));
  if (!date) return null;
  // A plan copied to another week must not carry the old week's date metadata.
  if (explicitDate && [localDateKey(date), localDateKey(addDays(date, 1))].includes(explicitDate)) return explicitDate;
  return localDateKey((date.getDay() + 1) % 7 === WEEK_DAY_TO_INDEX[startDay] ? addDays(date, 1) : date);
};

export const localDayAndZone = (now: Date) =>
  `${localDateKey(now)}/${Intl.DateTimeFormat().resolvedOptions().timeZone}/${now.getTimezoneOffset()}`;

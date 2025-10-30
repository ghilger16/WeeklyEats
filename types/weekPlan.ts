import { Meal } from "./meals";

export type PlannedWeekDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type CurrentPlannedWeek = Record<PlannedWeekDayKey, Meal["id"] | null>;

export const PLANNED_WEEK_ORDER: PlannedWeekDayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const PLANNED_WEEK_LABELS: Record<PlannedWeekDayKey, string> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

export const PLANNED_WEEK_DISPLAY_NAMES: Record<PlannedWeekDayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const createEmptyCurrentPlannedWeek = (): CurrentPlannedWeek =>
  PLANNED_WEEK_ORDER.reduce<CurrentPlannedWeek>((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as CurrentPlannedWeek);


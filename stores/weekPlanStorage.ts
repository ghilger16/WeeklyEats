import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CurrentPlannedWeek,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
  PLANNED_WEEK_ORDER,
} from "../types/weekPlan";

const STORAGE_KEY = "@weeklyeats/weekPlan";
const WEEK_PLAN_STREAK_KEY = "@weeklyeats/weekPlanStreak";

export type WeekPlanStreak = {
  count: number;
  lastCompletedWeekStartIso: string | null;
};

const defaultStreak: WeekPlanStreak = {
  count: 0,
  lastCompletedWeekStartIso: null,
};

const isValidDayKey = (value: unknown): value is PlannedWeekDayKey =>
  typeof value === "string" && (PLANNED_WEEK_ORDER as string[]).includes(value);

const normalizePlan = (raw: unknown): CurrentPlannedWeek | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const plan = createEmptyCurrentPlannedWeek();
  let hasValidEntry = false;

  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (isValidDayKey(key)) {
      if (typeof value === "string") {
        plan[key] = value;
        hasValidEntry = true;
      } else {
        plan[key] = null;
      }
    }
  });

  return hasValidEntry ? plan : plan;
};

export const getCurrentWeekPlan = async (): Promise<CurrentPlannedWeek | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyCurrentPlannedWeek();
    }

    const parsed = JSON.parse(raw) as unknown;
    return normalizePlan(parsed) ?? createEmptyCurrentPlannedWeek();
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to get plan", error);
    return createEmptyCurrentPlannedWeek();
  }
};

export const setCurrentWeekPlan = async (
  plan: CurrentPlannedWeek
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan", error);
  }
};

export const clearCurrentWeekPlan = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to clear plan", error);
  }
};

export const weekPlanStorageKey = STORAGE_KEY;

export const getWeekPlanStreak = async (): Promise<WeekPlanStreak> => {
  try {
    const raw = await AsyncStorage.getItem(WEEK_PLAN_STREAK_KEY);
    if (!raw) {
      return defaultStreak;
    }
    const parsed = JSON.parse(raw) as Partial<WeekPlanStreak>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.count !== "number"
    ) {
      return defaultStreak;
    }
    return {
      count: parsed.count ?? 0,
      lastCompletedWeekStartIso:
        typeof parsed.lastCompletedWeekStartIso === "string"
          ? parsed.lastCompletedWeekStartIso
          : null,
    };
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to get plan streak", error);
    return defaultStreak;
  }
};

export const updateWeekPlanStreak = async (
  weekStartDate: Date
): Promise<WeekPlanStreak> => {
  const current = await getWeekPlanStreak();
  const nextStartIso = weekStartDate.toISOString().slice(0, 10);
  const lastStartIso = current.lastCompletedWeekStartIso;

  let nextCount = current.count ?? 0;

  if (!lastStartIso) {
    nextCount = 1;
  } else if (lastStartIso === nextStartIso) {
    nextCount = current.count || 1;
  } else {
    const last = new Date(lastStartIso);
    const diffMs = weekStartDate.getTime() - last.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    nextCount = diffDays === 7 ? (current.count || 0) + 1 : 1;
  }

  const next: WeekPlanStreak = {
    count: nextCount,
    lastCompletedWeekStartIso: nextStartIso,
  };

  try {
    await AsyncStorage.setItem(WEEK_PLAN_STREAK_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan streak", error);
  }

  return next;
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CurrentPlannedWeek,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
  PLANNED_WEEK_ORDER,
} from "../types/weekPlan";

const STORAGE_KEY = "@weeklyeats/weekPlan";

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


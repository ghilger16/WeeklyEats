import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DayPinsPerWeek,
  DayPinsState,
  createEmptyDayPinsMap,
  normalizeDayPinsState,
} from "../types/dayPins";
import {
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../types/weekPlan";

const STORAGE_KEY = "@weeklyeats/dayPins";

const isValidDayKey = (value: unknown): value is PlannedWeekDayKey =>
  typeof value === "string" && (PLANNED_WEEK_ORDER as string[]).includes(value);

const normalizeMap = (raw: unknown): DayPinsPerWeek => {
  const map = createEmptyDayPinsMap();
  if (!raw || typeof raw !== "object") {
    return map;
  }

  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (isValidDayKey(key)) {
      map[key] = normalizeDayPinsState(
        (value ?? undefined) as Partial<DayPinsState> | undefined
      );
    }
  });
  return map;
};

export const getStoredDayPins = async (): Promise<DayPinsPerWeek> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyDayPinsMap();
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMap(parsed);
  } catch (error) {
    console.warn("[dayPinsStorage] Failed to load pins", error);
    return createEmptyDayPinsMap();
  }
};

export const setStoredDayPins = async (
  pins: DayPinsPerWeek
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch (error) {
    console.warn("[dayPinsStorage] Failed to persist pins", error);
  }
};

export const clearStoredDayPins = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[dayPinsStorage] Failed to clear pins", error);
  }
};

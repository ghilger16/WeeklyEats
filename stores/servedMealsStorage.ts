import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlannedWeekDayKey } from "../types/weekPlan";
import type { ServedOutcome } from "../components/week-dashboard/servedActions";

export type ServedMealEntry = {
  id: string;
  dayKey: PlannedWeekDayKey;
  mealId: string | null;
  servedAtISO: string;
  outcome: ServedOutcome;
  celebrationMessage?: string;
};

const STORAGE_KEY = "@weeklyeats/servedMeals";

const normalizeOutcome = (
  outcome: string | undefined
): ServedOutcome | null => {
  switch (outcome) {
    case "served":
    case "cookedAlt":
    case "ateOut":
    case "skipped":
      return outcome;
    case "cookedAsPlanned":
      return "served";
    default:
      return null;
  }
};

const parseEntries = (raw: string | null): ServedMealEntry[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof (item as ServedMealEntry).id !== "string" ||
          typeof (item as ServedMealEntry).dayKey !== "string" ||
          typeof (item as ServedMealEntry).servedAtISO !== "string"
        ) {
          return null;
        }

        const normalizedOutcome = normalizeOutcome(
          (item as { outcome?: string }).outcome
        );

        if (!normalizedOutcome) {
          return null;
        }

        return {
          ...(item as ServedMealEntry),
          outcome: normalizedOutcome,
        };
      })
      .filter((entry): entry is ServedMealEntry => Boolean(entry));
  } catch (error) {
    console.warn("[servedMealsStorage] Failed to parse entries", error);
    return [];
  }
};

const serializeEntries = (entries: ServedMealEntry[]): string => {
  try {
    return JSON.stringify(entries);
  } catch (error) {
    console.warn("[servedMealsStorage] Failed to serialize entries", error);
    return "[]";
  }
};

export const getServedMeals = async (): Promise<ServedMealEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return parseEntries(raw);
  } catch (error) {
    console.warn("[servedMealsStorage] Failed to get entries", error);
    return [];
  }
};

export const setServedMeals = async (
  entries: ServedMealEntry[]
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, serializeEntries(entries));
  } catch (error) {
    console.warn("[servedMealsStorage] Failed to persist entries", error);
  }
};

export type AddServedMealInput = Omit<ServedMealEntry, "id"> & {
  id?: string;
};

export const addServedMeal = async (
  input: AddServedMealInput
): Promise<ServedMealEntry[]> => {
  const existing = await getServedMeals();
  const id =
    input.id ??
    `${input.dayKey}-${new Date(input.servedAtISO).getTime().toString(36)}`;
  const entry: ServedMealEntry = {
    ...input,
    id,
  };

  const next = [
    entry,
    ...existing.filter(
      (item) =>
        !(
          item.dayKey === entry.dayKey &&
          new Date(item.servedAtISO).toDateString() ===
            new Date(entry.servedAtISO).toDateString()
        )
    ),
  ].sort(
    (a, b) =>
      new Date(b.servedAtISO).getTime() - new Date(a.servedAtISO).getTime()
  );

  await setServedMeals(next);
  return next;
};

export const clearServedMeals = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[servedMealsStorage] Failed to clear entries", error);
  }
};

export const servedMealsStorageKey = STORAGE_KEY;

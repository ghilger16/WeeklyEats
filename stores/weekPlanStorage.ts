import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CurrentPlannedWeek,
  CurrentWeekSides,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
  PLANNED_WEEK_ORDER,
} from "../types/weekPlan";

const LEGACY_PLAN_KEY = "@weeklyeats/weekPlan";
const LEGACY_PLAN_SIDES_KEY = "@weeklyeats/weekPlanSides";
const WEEK_PLAN_MAP_KEY = "@weeklyeats/weekPlanByWeek";
const WEEK_PLAN_SIDES_MAP_KEY = "@weeklyeats/weekPlanSidesByWeek";
const WEEK_PLAN_STREAK_KEY = "@weeklyeats/weekPlanStreak";
const WEEK_PLAN_HISTORY_KEY = "@weeklyeats/weekPlanHistory";

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

type WeekPlanMap = Record<string, CurrentPlannedWeek>;
type WeekSidesMap = Record<string, CurrentWeekSides>;
export type WeekPlanHistoryEntry = {
  weekStartISO: string;
  completedAtISO: string;
  plan: CurrentPlannedWeek;
};

const isValidISODateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);

const normalizePlan = (
  raw: unknown,
  weekStartISO?: string
): CurrentPlannedWeek | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const plan = createEmptyCurrentPlannedWeek({ weekStartISO });
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

  const weekedPlannedValue = (raw as { weekedPlanned?: unknown }).weekedPlanned;
  const hasAllDaysPlanned = PLANNED_WEEK_ORDER.every(
    (day) => typeof plan[day] === "string"
  );
  if (typeof weekedPlannedValue === "boolean") {
    plan.weekedPlanned = weekedPlannedValue;
  } else if (hasAllDaysPlanned) {
    plan.weekedPlanned = true;
  } else {
    plan.weekedPlanned = false;
  }

  const startIso =
    (raw as { weekStartISO?: unknown }).weekStartISO ?? weekStartISO;
  if (isValidISODateString(startIso)) {
    plan.weekStartISO = startIso;
  } else if (weekStartISO) {
    plan.weekStartISO = weekStartISO;
  }

  return plan;
};

const normalizeSides = (raw: unknown): CurrentWeekSides => {
  const sides = createEmptyCurrentWeekSides();
  if (!raw || typeof raw !== "object") {
    return sides;
  }
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (isValidDayKey(key) && Array.isArray(value)) {
      sides[key] = value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      );
    }
  });
  return sides;
};

const normalizePlanMap = (raw: unknown): WeekPlanMap => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return Object.entries(raw as Record<string, unknown>).reduce<WeekPlanMap>(
    (acc, [key, value]) => {
      if (!isValidISODateString(key)) {
        return acc;
      }
      const plan = normalizePlan(value, key);
      if (plan) {
        acc[key] = plan;
      }
      return acc;
    },
    {}
  );
};

const normalizeSidesMap = (raw: unknown): WeekSidesMap => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return Object.entries(raw as Record<string, unknown>).reduce<WeekSidesMap>(
    (acc, [key, value]) => {
      if (!isValidISODateString(key)) {
        return acc;
      }
      acc[key] = normalizeSides(value);
      return acc;
    },
    {}
  );
};

const savePlanMap = async (map: WeekPlanMap) => {
  try {
    await AsyncStorage.setItem(WEEK_PLAN_MAP_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan map", error);
  }
};

const saveSidesMap = async (map: WeekSidesMap) => {
  try {
    await AsyncStorage.setItem(WEEK_PLAN_SIDES_MAP_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan sides map", error);
  }
};

const getPlanMap = async (): Promise<WeekPlanMap> => {
  try {
    const raw = await AsyncStorage.getItem(WEEK_PLAN_MAP_KEY);
    if (!raw) {
      return {};
    }
    return normalizePlanMap(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to read plan map", error);
    return {};
  }
};

const getSidesMap = async (): Promise<WeekSidesMap> => {
  try {
    const raw = await AsyncStorage.getItem(WEEK_PLAN_SIDES_MAP_KEY);
    if (!raw) {
      return {};
    }
    return normalizeSidesMap(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to read plan sides map", error);
    return {};
  }
};

const cleanupStalePlans = (
  map: WeekPlanMap,
  referenceWeekStartISO: string
): WeekPlanMap => {
  const reference = new Date(referenceWeekStartISO);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  return Object.entries(map).reduce<WeekPlanMap>((acc, [key, value]) => {
    if (!isValidISODateString(key)) {
      return acc;
    }
    const start = new Date(key);
    const isOlderThanReference =
      reference.getTime() - start.getTime() >= oneWeekMs;
    if (isOlderThanReference && !value.weekedPlanned) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
};

const migrateLegacyPlan = async (
  weekStartISO: string
): Promise<CurrentPlannedWeek | null> => {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_PLAN_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    const plan = normalizePlan(parsed, weekStartISO);
    return plan ?? null;
  } catch {
    return null;
  }
};

const migrateLegacySides = async (): Promise<CurrentWeekSides | null> => {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_PLAN_SIDES_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSides(parsed);
  } catch {
    return null;
  }
};

export const getCurrentWeekPlan = async (
  weekStartISO: string
): Promise<CurrentPlannedWeek> => {
  const normalizedStart = isValidISODateString(weekStartISO)
    ? weekStartISO.slice(0, 10)
    : weekStartISO;

  let planMap = await getPlanMap();
  planMap = cleanupStalePlans(planMap, normalizedStart);
  const hasAnyPlans = Object.keys(planMap).length > 0;

  let plan = planMap[normalizedStart];
  if (!plan && !hasAnyPlans) {
    plan = (await migrateLegacyPlan(normalizedStart)) ?? null;
  }

  if (!plan) {
    plan = createEmptyCurrentPlannedWeek({
      weekStartISO: normalizedStart,
    });
  } else {
    plan.weekStartISO = normalizedStart;
  }

  planMap[normalizedStart] = plan;
  await savePlanMap(planMap);
  return plan;
};

export const setCurrentWeekPlan = async (
  weekStartISO: string,
  plan: CurrentPlannedWeek
): Promise<void> => {
  try {
    const normalizedStart = isValidISODateString(weekStartISO)
      ? weekStartISO.slice(0, 10)
      : weekStartISO;
    const planMap = await getPlanMap();
    planMap[normalizedStart] = {
      ...plan,
      weekStartISO: normalizedStart,
    };
    await savePlanMap(planMap);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan", error);
  }
};

export const getCurrentWeekSides = async (
  weekStartISO: string
): Promise<CurrentWeekSides> => {
  const normalizedStart = isValidISODateString(weekStartISO)
    ? weekStartISO.slice(0, 10)
    : weekStartISO;
  let sidesMap = await getSidesMap();
  const hasAnySides = Object.keys(sidesMap).length > 0;
  const sides =
    sidesMap[normalizedStart] ??
    (!hasAnySides ? await migrateLegacySides() : null) ??
    null;
  const normalizedSides = sides ? normalizeSides(sides) : null;
  const result = normalizedSides ?? createEmptyCurrentWeekSides();
  sidesMap[normalizedStart] = result;
  await saveSidesMap(sidesMap);
  return result;
};

export const setCurrentWeekSides = async (
  weekStartISO: string,
  sides: CurrentWeekSides
): Promise<void> => {
  try {
    const normalizedStart = isValidISODateString(weekStartISO)
      ? weekStartISO.slice(0, 10)
      : weekStartISO;
    const sidesMap = await getSidesMap();
    sidesMap[normalizedStart] = sides;
    await saveSidesMap(sidesMap);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist plan sides", error);
  }
};

export const clearCurrentWeekPlan = async (
  weekStartISO: string
): Promise<void> => {
  try {
    const normalizedStart = isValidISODateString(weekStartISO)
      ? weekStartISO.slice(0, 10)
      : weekStartISO;
    const planMap = await getPlanMap();
    const sidesMap = await getSidesMap();
    delete planMap[normalizedStart];
    delete sidesMap[normalizedStart];
    await Promise.all([savePlanMap(planMap), saveSidesMap(sidesMap)]);
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to clear plan", error);
  }
};

export const weekPlanStorageKey = WEEK_PLAN_MAP_KEY;

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

const getWeekPlanHistoryInternal = async (): Promise<WeekPlanHistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(WEEK_PLAN_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => {
        const maybe = entry as Partial<WeekPlanHistoryEntry>;
        if (
          !maybe ||
          !isValidISODateString(maybe.weekStartISO) ||
          typeof maybe.completedAtISO !== "string" ||
          !maybe.plan
        ) {
          return null;
        }
        const normalizedPlan = normalizePlan(maybe.plan, maybe.weekStartISO);
        if (!normalizedPlan) {
          return null;
        }
        return {
          weekStartISO: maybe.weekStartISO.slice(0, 10),
          completedAtISO: maybe.completedAtISO,
          plan: normalizedPlan,
        } as WeekPlanHistoryEntry;
      })
      .filter(Boolean) as WeekPlanHistoryEntry[];
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to read history", error);
    return [];
  }
};

const saveWeekPlanHistoryInternal = async (
  entries: WeekPlanHistoryEntry[]
) => {
  try {
    await AsyncStorage.setItem(WEEK_PLAN_HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("[weekPlanStorage] Failed to persist history", error);
  }
};

export const addWeekPlanHistory = async (
  plan: CurrentPlannedWeek,
  options: { maxEntries?: number } = {}
): Promise<void> => {
  const { maxEntries = 12 } = options;
  const startISO = plan.weekStartISO;
  if (!startISO || !isValidISODateString(startISO) || !plan.weekedPlanned) {
    return;
  }
  const existing = await getWeekPlanHistoryInternal();
  const completedAtISO = new Date().toISOString();
  const deduped = existing.filter(
    (entry) => entry.weekStartISO !== startISO.slice(0, 10)
  );
  deduped.unshift({
    weekStartISO: startISO.slice(0, 10),
    completedAtISO,
    plan,
  });
  deduped.sort(
    (a, b) =>
      new Date(b.weekStartISO).getTime() - new Date(a.weekStartISO).getTime()
  );
  const trimmed = deduped.slice(0, Math.max(1, maxEntries));
  await saveWeekPlanHistoryInternal(trimmed);
};

export const getWeekPlanHistory = async (): Promise<WeekPlanHistoryEntry[]> => {
  return getWeekPlanHistoryInternal();
};

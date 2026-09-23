import { ServedMealEntry } from "../stores/servedMealsStorage";

export const DAY_MS = 86_400_000;

/** Actual servings only; invalid/future entries cannot establish eating history. */
export const getLatestServedDates = (
  history: ServedMealEntry[],
  now = Date.now(),
): Map<string, number> => {
  const latest = new Map<string, number>();
  history.forEach((entry) => {
    const timestamp = Date.parse(entry.servedAtISO);
    if (entry.outcome !== "served" || !entry.mealId || !Number.isFinite(timestamp) || timestamp > now) return;
    latest.set(entry.mealId, Math.max(latest.get(entry.mealId) ?? -Infinity, timestamp));
  });
  return latest;
};

export const getDaysSinceServed = (timestamp: number | undefined, now = Date.now()) =>
  timestamp === undefined ? null : Math.max(0, (now - timestamp) / DAY_MS);

export const getRepeatTimingScore = (daysSince: number | null, weeks?: number | null) =>
  !weeks ? 0 : daysSince === null || daysSince >= weeks * 7 ? 20 : -25;

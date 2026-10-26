import AsyncStorage from "@react-native-async-storage/async-storage";
import { mealsStorageKey } from "./mealsStorage";
import { servedMealsStorageKey } from "./servedMealsStorage";
import { weekPlanStorageKey, weekPlanSidesStorageKey } from "./weekPlanStorage";
import { PLANNED_WEEK_ORDER } from "../types/weekPlan";
import type { WidgetSource } from "../utils/todayWidgetPlan";

// Read-only: ordinary plan getters historically rewrote storage while reading.
// A failed read/parse must leave the last good shared widget snapshot intact.
export async function readWidgetSource(): Promise<WidgetSource> {
  const rows = await AsyncStorage.multiGet([mealsStorageKey, servedMealsStorageKey,
    weekPlanStorageKey, weekPlanSidesStorageKey, "weeklyeats.weekStartDay",
    "@weeklyeats/weekPlan", "@weeklyeats/weekPlanSides"]);
  const values = Object.fromEntries(rows);
  const read = (key: string, fallback: unknown) => values[key] ? JSON.parse(values[key]!) : fallback;
  const plans = read(weekPlanStorageKey, {});
  const sides = read(weekPlanSidesStorageKey, {});
  const meals = read(mealsStorageKey, []);
  const servedEntries = read(servedMealsStorageKey, []);
  if (!plans || typeof plans !== "object" || Array.isArray(plans) ||
      !sides || typeof sides !== "object" || Array.isArray(sides) ||
      !Array.isArray(meals) || !Array.isArray(servedEntries)) throw new Error("Invalid widget source storage");
  if (!Object.keys(plans).length) {
    const legacy = read("@weeklyeats/weekPlan", null);
    // Never attach an undated legacy plan to today's week by guesswork.
    if (legacy?.weekStartISO) {
      plans[legacy.weekStartISO] = legacy;
      sides[legacy.weekStartISO] = read("@weeklyeats/weekPlanSides", {});
    }
  }
  const preference = values["weeklyeats.weekStartDay"] as WidgetSource["startDay"];
  return { plans, sides, meals, servedEntries,
    startDay: PLANNED_WEEK_ORDER.includes(preference) ? preference : "mon" };
}

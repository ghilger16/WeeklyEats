import { NativeModules, Platform } from "react-native";

export type TodayWidgetMeal = {
  mealId?: string;
  isPlanned?: boolean;
  dateKey?: string;
  dateISO: string;
  title: string;
  icon: string;
  dateLabel: string;
  sides: string[];
  prepNote?: string;
  recipeUrl?: string;
  mealDate?: string;
  weekStartDate?: string;
  servedState?: "served" | "cookedAlt" | "ateOut" | "skipped";
};

export type TodayWidgetPayload = {
  generatedAtISO: string;
  schemaVersion?: number;
  snapshotGeneratedAt?: string;
  snapshotDate?: string;
  snapshotTimeZone?: string;
  snapshotUTCOffsetMinutes?: number;
  outcomesByDate?: Record<string, { mealId: string | null; servedState: NonNullable<TodayWidgetPayload["todayOutcome"]> }>;
  plannedMeals?: TodayWidgetMeal[];
  today: TodayWidgetMeal;
  tomorrow?: TodayWidgetMeal;
  todayOutcome?: "served" | "cookedAlt" | "ateOut" | "skipped";
};

type TodayWidgetBridgeModule = {
  savePayload?: (payload: TodayWidgetPayload) => Promise<boolean>;
  repairPayload?: (payload: TodayWidgetPayload) => Promise<boolean>;
  clearPayload?: () => Promise<boolean>;
};

const bridge = NativeModules.TodayWidgetBridge as
  | TodayWidgetBridgeModule
  | undefined;

export const saveTodayWidgetPayload = async (
  payload: TodayWidgetPayload,
  force = false
): Promise<boolean> => {
  if (Platform.OS !== "ios" || !bridge?.savePayload) {
    if (force) throw new Error("Widget repair requires the latest iOS recovery build.");
    return false;
  }

  try {
    if (force) {
      if (!bridge.repairPayload) throw new Error("Install the recovery build to repair the widget.");
      return await bridge.repairPayload(payload);
    }
    return await bridge.savePayload(payload);
  } catch (error) {
    console.warn("[todayWidgetStorage] Failed to save widget payload", error);
    if (force) throw error;
    return false;
  }
};

export const clearTodayWidgetPayload = async (): Promise<void> => {
  if (Platform.OS !== "ios" || !bridge?.clearPayload) {
    return;
  }

  try {
    await bridge.clearPayload();
  } catch (error) {
    console.warn("[todayWidgetStorage] Failed to clear widget payload", error);
  }
};

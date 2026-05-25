import { NativeModules, Platform } from "react-native";

export type TodayWidgetPayload = {
  title: string;
  icon: string;
  dateLabel: string;
  sides: string[];
  recipeUrl?: string;
};

type TodayWidgetBridgeModule = {
  savePayload?: (payload: TodayWidgetPayload) => Promise<boolean>;
  clearPayload?: () => Promise<boolean>;
};

const bridge = NativeModules.TodayWidgetBridge as
  | TodayWidgetBridgeModule
  | undefined;

export const saveTodayWidgetPayload = async (
  payload: TodayWidgetPayload
): Promise<void> => {
  if (Platform.OS !== "ios" || !bridge?.savePayload) {
    return;
  }

  try {
    await bridge.savePayload(payload);
  } catch (error) {
    console.warn("[todayWidgetStorage] Failed to save widget payload", error);
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

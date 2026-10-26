import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { getSmartLevel } from "../utils/smartLevel";

const STORAGE_KEY = "@weeklyeats/debugSmartLevel";
let override: 5 | null = null;
let hydration: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => override;
const hydrate = () => {
  if (!hydration) {
    hydration = AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      override = stored === "5" ? 5 : null;
      emit();
    }).catch(console.warn);
  }
  return hydration;
};

export const setSmartLevelTestOverride = async (level: 5 | null) => {
  if (!__DEV__) return;
  await hydrate();
  if (level === null) await AsyncStorage.removeItem(STORAGE_KEY);
  else await AsyncStorage.setItem(STORAGE_KEY, "5");
  override = level;
  emit();
};

export const useSmartLevel = (input: Parameters<typeof getSmartLevel>[0]) => {
  const testLevel = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (__DEV__) void hydrate();
  }, []);
  return (__DEV__ ? testLevel : null) ?? getSmartLevel(input);
};

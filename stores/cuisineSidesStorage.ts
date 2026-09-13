import AsyncStorage from "@react-native-async-storage/async-storage";
import { CuisineType, isCuisineType } from "../types/cuisine";
import { CuisineSideOverrides } from "../utils/cuisineSideSuggestions";

export const CUISINE_SIDES_STORAGE_KEY = "@weeklyeats/cuisineSides";

export const normalizeCuisineSides = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((side): side is string => typeof side === "string")
    .map((side) => side.trim().replace(/\s+/g, " "))
    .filter((side) => {
      const key = side.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
};

let snapshot: CuisineSideOverrides = {};
let hydration: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export const getCuisineSidesSnapshot = () => snapshot;
export const subscribeCuisineSides = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const emit = () => listeners.forEach((listener) => listener());

export const loadCuisineSides = () => {
  if (!hydration) {
    hydration = (async () => {
      const raw = await AsyncStorage.getItem(CUISINE_SIDES_STORAGE_KEY);
      let parsed: unknown;
      try { parsed = JSON.parse(raw ?? "{}"); } catch { parsed = {}; }
      const next: CuisineSideOverrides = {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([key, value]) => {
          if (isCuisineType(key) && Array.isArray(value)) next[key] = normalizeCuisineSides(value);
        });
      }
      snapshot = next;
      emit();
    })().catch((error) => { hydration = undefined; throw error; });
  }
  return hydration;
};

export const saveCuisineSides = (cuisine: CuisineType, sides: string[]) => {
  const operation = queue.then(async () => {
    await loadCuisineSides();
    const next = { ...snapshot, [cuisine]: normalizeCuisineSides(sides) };
    await AsyncStorage.setItem(CUISINE_SIDES_STORAGE_KEY, JSON.stringify(next));
    snapshot = next;
    emit();
  });
  queue = operation.catch(() => {});
  return operation;
};

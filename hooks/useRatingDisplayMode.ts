import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type RatingDisplayMode = "family" | "summary" | "off";

export const isFamilyRatingsEligible = (familyMemberCount: number) =>
  familyMemberCount > 1;

const STORAGE_KEY = "@weeklyeats/ratingDisplayMode";
let currentMode: RatingDisplayMode = "family";
let hydrationStarted = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const hydrate = () => {
  if (hydrationStarted) return;
  hydrationStarted = true;
  AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
    if (stored === "family" || stored === "summary" || stored === "off") {
      // "off" was part of the former meal-card customization control. Rating
      // style now always selects one of the two rating experiences.
      currentMode = stored === "off" ? "summary" : stored;
      emit();
      if (stored === "off") {
        AsyncStorage.setItem(STORAGE_KEY, "summary").catch((error) =>
          console.warn("[ratingDisplayMode] Failed to update legacy preference", error),
        );
      }
    }
  }).catch((error) => console.warn("[ratingDisplayMode] Failed to read preference", error));
};

export const useRatingDisplayMode = () => {
  const mode = useSyncExternalStore(subscribe, () => currentMode, () => currentMode);
  useEffect(hydrate, []);
  const setMode = useCallback((next: RatingDisplayMode) => {
    currentMode = next;
    emit();
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) =>
      console.warn("[ratingDisplayMode] Failed to save preference", error),
    );
  }, []);
  return { mode, setMode };
};

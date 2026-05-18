import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import featureFlags, { FeatureFlags } from "../config/featureFlags";

const STORAGE_KEY = "@weeklyeats/featureFlagOverrides";

type FeatureFlagOverrides = Partial<FeatureFlags>;
type FeatureFlagsListener = () => void;

let currentFlags: FeatureFlags = { ...featureFlags };
let currentOverrides: FeatureFlagOverrides = {};
let hasHydrated = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<FeatureFlagsListener>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const applyOverrides = (overrides: FeatureFlagOverrides) => {
  currentOverrides = overrides;
  currentFlags = {
    ...featureFlags,
    ...overrides,
  };
};

const parseOverrides = (raw: string | null): FeatureFlagOverrides => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(featureFlags).reduce<FeatureFlagOverrides>(
      (acc, key) => {
        const typedKey = key as keyof FeatureFlags;
        if (typeof parsed[typedKey] === "boolean") {
          acc[typedKey] = parsed[typedKey];
        }
        return acc;
      },
      {}
    );
  } catch (error) {
    console.warn("[featureFlags] Failed to parse overrides", error);
    return {};
  }
};

export const hydrateFeatureFlagOverrides = async (): Promise<void> => {
  if (hasHydrated) {
    return;
  }
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      applyOverrides(parseOverrides(raw));
      hasHydrated = true;
      emit();
    })
    .catch((error) => {
      console.warn("[featureFlags] Failed to hydrate overrides", error);
      hasHydrated = true;
    })
    .finally(() => {
      hydratePromise = null;
    });

  return hydratePromise;
};

export const setFeatureFlagOverride = async <K extends keyof FeatureFlags>(
  key: K,
  value: FeatureFlags[K]
): Promise<void> => {
  const next = {
    ...currentOverrides,
    [key]: value,
  };
  applyOverrides(next);
  emit();

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("[featureFlags] Failed to persist override", error);
  }
};

export const resetFeatureFlagOverrides = async (): Promise<void> => {
  applyOverrides({});
  emit();

  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[featureFlags] Failed to reset overrides", error);
  }
};

export const getFeatureFlagDefaults = (): FeatureFlags => featureFlags;

export const useFeatureFlags = (): FeatureFlags => {
  const [flags, setFlags] = useState(currentFlags);

  useEffect(() => {
    const listener = () => setFlags(currentFlags);
    listeners.add(listener);
    hydrateFeatureFlagOverrides();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return flags;
};

export const useFeatureFlag = <K extends keyof FeatureFlags>(
  key: K
): FeatureFlags[K] => {
  const flags = useFeatureFlags();
  return flags[key];
};

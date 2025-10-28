import { useMemo } from "react";
import featureFlags, { FeatureFlags } from "../config/featureFlags";

export const useFeatureFlags = (): FeatureFlags => {
  return useMemo(() => featureFlags, []);
};

export const useFeatureFlag = <K extends keyof FeatureFlags>(
  key: K
): FeatureFlags[K] => {
  const flags = useFeatureFlags();
  return flags[key];
};

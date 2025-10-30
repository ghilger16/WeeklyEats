import rawFeatureFlags from "./featureFlags.json";

type FeatureFlags = {
  recipeAutoFillEnabled: boolean;
  weekDashboardDateControlsEnabled: boolean;
};

const featureFlags: FeatureFlags = {
  recipeAutoFillEnabled: Boolean(rawFeatureFlags.recipeAutoFillEnabled),
  weekDashboardDateControlsEnabled: Boolean(
    rawFeatureFlags.weekDashboardDateControlsEnabled
  ),
};

export type { FeatureFlags };
export default featureFlags;

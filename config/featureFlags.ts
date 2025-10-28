import rawFeatureFlags from "./featureFlags.json";

type FeatureFlags = {
  recipeAutoFillEnabled: boolean;
};

const featureFlags: FeatureFlags = {
  recipeAutoFillEnabled: Boolean(rawFeatureFlags.recipeAutoFillEnabled),
};

export type { FeatureFlags };
export default featureFlags;

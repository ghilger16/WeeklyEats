import { NativeModules, Platform } from "react-native";

export type PendingRecipeImport = {
  id: string;
  recipeUrl: string;
  sharedAt?: string;
  source?: string;
};

type PendingRecipeImportsModule = {
  getPendingImports: () => Promise<unknown>;
  removePendingImport: (importId: string) => Promise<void>;
};

const nativeModule = NativeModules.PendingRecipeImports as
  | PendingRecipeImportsModule
  | undefined;

const isPendingRecipeImport = (
  value: unknown
): value is PendingRecipeImport => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.recipeUrl === "string" &&
    item.recipeUrl.trim().length > 0
  );
};

export const getPendingRecipeImports = async (): Promise<
  PendingRecipeImport[]
> => {
  if (Platform.OS !== "ios" || !nativeModule) {
    return [];
  }

  const result = await nativeModule.getPendingImports();
  return Array.isArray(result) ? result.filter(isPendingRecipeImport) : [];
};

export const removePendingRecipeImport = async (
  importId: string
): Promise<void> => {
  if (Platform.OS !== "ios" || !nativeModule || !importId.trim()) {
    return;
  }

  await nativeModule.removePendingImport(importId);
};

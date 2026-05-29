import { NativeModules, Platform } from "react-native";

export type PendingRecipeImport = {
  id: string;
  recipeUrl: string;
  title?: string;
  url?: string;
  domain?: string;
  imageUrl?: string;
  createdAt?: string;
  sharedAt?: string;
  source?: string;
  planForLater?: boolean;
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
  const recipeUrl =
    typeof item.recipeUrl === "string" ? item.recipeUrl : item.url;

  if (
    typeof item.id !== "string" ||
    item.id.trim().length === 0 ||
    typeof recipeUrl !== "string" ||
    recipeUrl.trim().length === 0
  ) {
    return false;
  }

  item.recipeUrl = recipeUrl;
  return true;
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

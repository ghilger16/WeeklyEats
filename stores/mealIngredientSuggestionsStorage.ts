import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ingredient, ShoppingCategory } from "../types/meals";

const STORAGE_KEY = "@weeklyeats/mealIngredientSuggestions";

type CachedSuggestionEntry = {
  titleKey: string;
  ingredients: Ingredient[];
};

type SuggestionMap = Record<string, CachedSuggestionEntry>;

const SHOPPING_CATEGORIES = new Set<ShoppingCategory>([
  "produce", "meat", "seafood", "dairy", "bakery", "deli", "frozen",
  "pantry", "canned", "pastaAndRice", "spices", "condiments", "baking",
  "beverages", "snacks", "household", "other",
]);

const normalizeTitle = (title: string) => title.trim().toLocaleLowerCase();

const normalizeIngredient = (value: unknown): Ingredient | null => {
  if (!value || typeof value !== "object") return null;
  const ingredient = value as Partial<Ingredient>;
  const name = typeof ingredient.name === "string" ? ingredient.name.trim() : "";
  if (!name) return null;
  return {
    name,
    category: SHOPPING_CATEGORIES.has(ingredient.category as ShoppingCategory)
      ? (ingredient.category as ShoppingCategory)
      : "other",
    ingredientType:
      ingredient.ingredientType === "pantryStaple"
        ? "pantryStaple"
        : "keyIngredient",
  };
};

const readMap = async (): Promise<SuggestionMap> => {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<SuggestionMap>((result, [mealId, value]) => {
      const entry = value as Partial<CachedSuggestionEntry>;
      if (typeof entry.titleKey !== "string" || !Array.isArray(entry.ingredients)) {
        return result;
      }
      const ingredients = entry.ingredients
        .map(normalizeIngredient)
        .filter((ingredient): ingredient is Ingredient => Boolean(ingredient));
      if (ingredients.length) result[mealId] = { titleKey: entry.titleKey, ingredients };
      return result;
    }, {});
  } catch {
    return {};
  }
};

let storageQueue: Promise<unknown> = Promise.resolve();

const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
};

export const getCachedMealIngredientSuggestions = (
  mealId: string,
  mealTitle: string,
): Promise<Ingredient[] | null> =>
  enqueue(async () => {
    const map = await readMap();
    const entry = map[mealId];
    return entry?.titleKey === normalizeTitle(mealTitle)
      ? entry.ingredients
      : null;
  });

export const setCachedMealIngredientSuggestions = (
  mealId: string,
  mealTitle: string,
  ingredients: Ingredient[],
): Promise<void> =>
  enqueue(async () => {
    const map = await readMap();
    map[mealId] = {
      titleKey: normalizeTitle(mealTitle),
      ingredients: ingredients.map((ingredient) => ({ ...ingredient })),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  });

export const mealIngredientSuggestionsStorageKey = STORAGE_KEY;

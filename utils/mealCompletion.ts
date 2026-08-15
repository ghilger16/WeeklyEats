import {
  Ingredient,
  Meal,
  MealIngredient,
  ShoppingCategory,
} from "../types/meals";

export type MealIngredientSuggestions = {
  keyIngredients: Ingredient[];
  pantryStaples: Ingredient[];
};

export type MealIngredientSuggestionOutcome =
  | { ok: true; data: MealIngredientSuggestions }
  | { ok: false; error: string };

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const suggestionCache = new Map<
  string,
  Promise<MealIngredientSuggestionOutcome>
>();

const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  "produce", "meat", "seafood", "dairy", "bakery", "deli", "frozen",
  "pantry", "canned", "pastaAndRice", "spices", "condiments", "baking",
  "beverages", "snacks", "household", "other",
];

const getIngredientName = (ingredient: MealIngredient) =>
  typeof ingredient === "string" ? ingredient.trim() : ingredient.name.trim();

export const isMealIncomplete = (meal: Meal) => {
  const hasKeyIngredients = (meal.ingredients ?? []).some((ingredient) => {
    const name = getIngredientName(ingredient);
    if (!name) return false;
    return typeof ingredient === "string" ||
      ingredient.ingredientType !== "pantryStaple";
  });
  return (
    !hasKeyIngredients ||
    typeof meal.difficulty !== "number" ||
    typeof meal.expense !== "number"
  );
};

const normalizeIngredient = (value: unknown): Ingredient | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Ingredient>;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) return null;
  return {
    name,
    category: SHOPPING_CATEGORIES.includes(item.category as ShoppingCategory)
      ? (item.category as ShoppingCategory)
      : "other",
    ingredientType:
      item.ingredientType === "pantryStaple"
        ? "pantryStaple"
        : "keyIngredient",
  };
};

const requestSuggestions = async (
  title: string
): Promise<MealIngredientSuggestionOutcome> => {
  if (!API_BASE_URL) {
    return { ok: false, error: "Ingredient suggestions are not configured." };
  }
  try {
    const response = await fetch(
      `${API_BASE_URL.replace(/\/+$/, "")}/.netlify/functions/recipeAutoFill`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionTitle: title.trim() }),
      }
    );
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      return { ok: false, error: payload?.error ?? "Suggestions failed." };
    }
    const ingredients = Array.isArray(payload.data?.ingredients)
      ? payload.data.ingredients.map(normalizeIngredient).filter(Boolean) as Ingredient[]
      : [];
    return {
      ok: true,
      data: {
        keyIngredients: ingredients.filter(
          (item) => item.ingredientType === "keyIngredient"
        ),
        pantryStaples: ingredients.filter(
          (item) => item.ingredientType === "pantryStaple"
        ),
      },
    };
  } catch (error) {
    return { ok: false, error: "We couldn’t suggest ingredients right now." };
  }
};

export const suggestIngredientsForMealTitle = (title: string) => {
  const cacheKey = title.trim().toLowerCase();
  const cached = suggestionCache.get(cacheKey);
  if (cached) return cached;
  const request = requestSuggestions(title);
  suggestionCache.set(cacheKey, request);
  return request;
};

export const retryIngredientSuggestions = (title: string) => {
  suggestionCache.delete(title.trim().toLowerCase());
  return suggestIngredientsForMealTitle(title);
};

export const mergeConfirmedIngredients = (
  existing: Meal["ingredients"] = [],
  confirmed: Ingredient[]
) => {
  const seen = new Set(existing.map((item) => getIngredientName(item).toLowerCase()));
  return [
    ...existing,
    ...confirmed.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
};

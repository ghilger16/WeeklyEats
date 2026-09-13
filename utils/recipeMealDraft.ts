import { canonicalIngredientName, normalizeIngredientNames } from "./ingredientNormalization";
import { Ingredient, IngredientType, ShoppingCategory } from "../types/meals";
import { RecipeAutoFillResult } from "./recipeAutoFill";
import { classifyIngredients } from "./ingredientClassification";

export type IngredientValue =
  | string
  | { name?: unknown; category?: unknown; ingredientType?: unknown };

const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "deli",
  "frozen",
  "pantry",
  "canned",
  "pastaAndRice",
  "spices",
  "condiments",
  "baking",
  "beverages",
  "snacks",
  "household",
  "other",
];

const normalizeCategory = (value: unknown): ShoppingCategory =>
  typeof value === "string" &&
  SHOPPING_CATEGORIES.includes(value as ShoppingCategory)
    ? (value as ShoppingCategory)
    : "other";

const normalizeIngredientType = (value: unknown): IngredientType =>
  value === "pantryStaple" ? "pantryStaple" : "keyIngredient";

export const getIngredientName = (ingredient: IngredientValue) => {
  if (typeof ingredient === "string") {
    return ingredient.trim();
  }
  if (
    ingredient &&
    typeof ingredient === "object" &&
    typeof ingredient.name === "string"
  ) {
    return ingredient.name.trim();
  }
  return "";
};

export const normalizeIngredientValue = (
  ingredient: IngredientValue
): Ingredient | null => {
  const name = canonicalIngredientName(getIngredientName(ingredient));
  if (!name) {
    return null;
  }
  if (typeof ingredient === "string") {
    return {
      name,
      category: "other",
      ingredientType: "keyIngredient",
    };
  }
  return {
    name,
    category: normalizeCategory(ingredient.category),
    ingredientType: normalizeIngredientType(ingredient.ingredientType),
  };
};

export const isIngredient = (ingredient: Ingredient | null): ingredient is Ingredient =>
  Boolean(ingredient);


export const prepareRecipeMealDraft = async (result: RecipeAutoFillResult) => ({
  title: result.title?.trim() ?? "",
  ingredients: await classifyIngredients(
    normalizeIngredientNames((Array.isArray(result.ingredients) ? result.ingredients : [])
      .map(normalizeIngredientValue).filter(isIngredient)),
  ),
  cuisine: result.cuisine,
  difficulty: typeof result.difficulty === "number" ? toLevel(result.difficulty) : undefined,
  expense: typeof result.expense === "number" ? Math.min(5, Math.max(1, Math.round(result.expense))) : undefined,
  prepNotes: result.prepNotes?.trim() ?? "",
  preferredSides: result.suggestedSides ?? [],
});

const toLevel = (value: number) => {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return clamped < 2 ? 1 : clamped < 4 ? 3 : 5;
};

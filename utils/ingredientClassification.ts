import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ingredient, IngredientType } from "../types/meals";

export type IngredientClassification = "key" | "pantry";
export type IngredientClassificationPreferences = Record<
  string,
  IngredientClassification
>;

const STORAGE_KEY = "weekly-eats:ingredient-classification-preferences:v1";

export const DEFAULT_PANTRY_STAPLES = [
  "salt",
  "kosher salt",
  "black pepper",
  "pepper",
  "olive oil",
  "vegetable oil",
  "canola oil",
  "cooking oil",
  "garlic powder",
  "onion powder",
  "chili powder",
  "paprika",
  "smoked paprika",
  "cumin",
  "oregano",
  "basil",
  "thyme",
  "rosemary",
  "parsley",
  "cayenne",
  "red pepper flakes",
  "cinnamon",
  "nutmeg",
  "flour",
  "all-purpose flour",
  "sugar",
  "brown sugar",
  "baking powder",
  "baking soda",
  "soy sauce",
  "vinegar",
  "white vinegar",
  "apple cider vinegar",
] as const;

const pantryStaples = new Set<string>(DEFAULT_PANTRY_STAPLES);
let preferences: IngredientClassificationPreferences = {};
let hydrationPromise: Promise<void> | null = null;

export const normalizeIngredientClassificationName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const isDefaultPantryStaple = (name: string) =>
  pantryStaples.has(normalizeIngredientClassificationName(name));

const toIngredientType = (
  classification: IngredientClassification,
): IngredientType =>
  classification === "pantry" ? "pantryStaple" : "keyIngredient";

const toClassification = (
  ingredientType: IngredientType,
): IngredientClassification =>
  ingredientType === "pantryStaple" ? "pantry" : "key";

export const loadIngredientClassificationPreferences = async () => {
  if (hydrationPromise) {
    await hydrationPromise;
    return preferences;
  }
  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      preferences = Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, IngredientClassification] =>
            entry[1] === "key" || entry[1] === "pantry",
        ),
      );
    } catch (error) {
      console.warn("Unable to load ingredient classification preferences", error);
    }
  })();
  await hydrationPromise;
  return preferences;
};

export const classifyIngredientType = async (
  name: string,
  suggestedType?: IngredientType,
): Promise<IngredientType> => {
  await loadIngredientClassificationPreferences();
  const normalizedName = normalizeIngredientClassificationName(name);
  const preference = preferences[normalizedName];
  if (preference) return toIngredientType(preference);
  if (isDefaultPantryStaple(normalizedName)) return "pantryStaple";
  return suggestedType ?? "keyIngredient";
};

export const classifyIngredient = async (
  ingredient: Ingredient,
): Promise<Ingredient> => ({
  ...ingredient,
  ingredientType: await classifyIngredientType(
    ingredient.name,
    ingredient.ingredientType,
  ),
});

export const classifyIngredients = (ingredients: Ingredient[]) =>
  Promise.all(ingredients.map(classifyIngredient));

export const setIngredientClassificationPreference = async (
  name: string,
  ingredientType: IngredientType,
) => {
  await loadIngredientClassificationPreferences();
  const normalizedName = normalizeIngredientClassificationName(name);
  if (!normalizedName) return;
  preferences = {
    ...preferences,
    [normalizedName]: toClassification(ingredientType),
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn("Unable to save ingredient classification preference", error);
  }
};

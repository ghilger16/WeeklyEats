import { Meal, MealIngredient } from "../types/meals";
import { isDefaultPantryStaple } from "./ingredientClassification";

export type IngredientOverlap = {
  sharedIngredients: string[];
  sharedCount: number;
  candidateIngredientCount: number;
  overlapRatio: number;
  score: number;
};

export type RankedIngredientMeal = {
  meal: Meal;
  overlap: IngredientOverlap;
};

export const INGREDIENT_OVERLAP_MINIMUM = 2;
export const INGREDIENT_OVERLAP_RATIO_WEIGHT = 3;

const normalizeWord = (word: string) => {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (
    word.length > 3 &&
    word.endsWith("s") &&
    !word.endsWith("ss") &&
    !word.endsWith("us") &&
    !word.endsWith("is")
  ) {
    return word.slice(0, -1);
  }
  return word;
};

export const normalizeIngredientName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(normalizeWord)
    .join(" ");

const getIngredientName = (ingredient: MealIngredient) =>
  typeof ingredient === "string" ? ingredient : ingredient.name;

const isMeaningfulKeyIngredient = (ingredient: MealIngredient) => {
  if (typeof ingredient !== "string") {
    return ingredient.ingredientType === "keyIngredient";
  }
  return !isDefaultPantryStaple(ingredient);
};

const getMeaningfulIngredientMap = (meal: Meal) => {
  const ingredients = new Map<string, string>();
  (meal.ingredients ?? []).forEach((ingredient) => {
    if (!isMeaningfulKeyIngredient(ingredient)) return;
    const displayName = getIngredientName(ingredient).trim().replace(/\s+/g, " ");
    const normalizedName = normalizeIngredientName(displayName);
    if (normalizedName && !ingredients.has(normalizedName)) {
      ingredients.set(normalizedName, displayName);
    }
  });
  return ingredients;
};

export const getIngredientOverlap = (
  candidateMeal: Meal,
  plannedMeals: Meal[],
): IngredientOverlap => {
  const candidateIngredients = getMeaningfulIngredientMap(candidateMeal);
  const plannedIngredientNames = new Set(
    plannedMeals.flatMap((meal) => [...getMeaningfulIngredientMap(meal).keys()]),
  );
  const sharedIngredients = [...candidateIngredients]
    .filter(([normalizedName]) => plannedIngredientNames.has(normalizedName))
    .map(([, displayName]) => displayName);
  const candidateIngredientCount = candidateIngredients.size;
  const sharedCount = sharedIngredients.length;
  const overlapRatio = candidateIngredientCount
    ? sharedCount / candidateIngredientCount
    : 0;

  return {
    sharedIngredients,
    sharedCount,
    candidateIngredientCount,
    overlapRatio,
    score: sharedCount + overlapRatio * INGREDIENT_OVERLAP_RATIO_WEIGHT,
  };
};

export const rankMealsByIngredientOverlap = (
  candidateMeals: Meal[],
  plannedMeals: Meal[],
  minimumSharedIngredients = INGREDIENT_OVERLAP_MINIMUM,
): RankedIngredientMeal[] =>
  candidateMeals
    .map((meal) => ({ meal, overlap: getIngredientOverlap(meal, plannedMeals) }))
    .filter(({ overlap }) => overlap.sharedCount >= minimumSharedIngredients)
    .sort(
      (left, right) =>
        right.overlap.score - left.overlap.score ||
        right.overlap.sharedCount - left.overlap.sharedCount ||
        left.meal.title.localeCompare(right.meal.title),
    );

export const formatSharedIngredientPreview = (
  sharedIngredients: string[],
  visibleCount = 4,
) => {
  const visible = sharedIngredients.slice(0, visibleCount);
  const remaining = sharedIngredients.length - visible.length;
  return `${visible.join(" · ")}${remaining > 0 ? ` +${remaining}` : ""}`;
};

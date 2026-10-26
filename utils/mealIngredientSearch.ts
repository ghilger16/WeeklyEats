import { Meal } from "../types/meals";

export type IngredientSearchResult = {
  name: string;
  normalizedName: string;
  mealCount: number;
};

const normalizeIngredientName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const getMealIngredientNames = (meal: Meal) =>
  (meal.ingredients ?? [])
    .map((ingredient) =>
      typeof ingredient === "string" ? ingredient : ingredient.name
    )
    .map((name) => name.trim())
    .filter(Boolean);

export const mealContainsIngredient = (meal: Meal, normalizedIngredient: string) =>
  getMealIngredientNames(meal).some(
    (name) => normalizeIngredientName(name) === normalizedIngredient
  );

export const getIngredientSearchResults = (
  scopedMeals: Meal[],
  query: string
): IngredientSearchResult[] => {
  const normalizedQuery = normalizeIngredientName(query);
  if (!normalizedQuery) return [];

  const index = new Map<
    string,
    { name: string; mealIds: Set<string> }
  >();

  scopedMeals.forEach((meal) => {
    const seenInMeal = new Set<string>();
    getMealIngredientNames(meal).forEach((name) => {
      const normalizedName = normalizeIngredientName(name);
      if (!normalizedName.includes(normalizedQuery) || seenInMeal.has(normalizedName)) {
        return;
      }
      seenInMeal.add(normalizedName);
      const current = index.get(normalizedName) ?? { name, mealIds: new Set<string>() };
      current.mealIds.add(meal.id);
      index.set(normalizedName, current);
    });
  });

  const matchStrength = (name: string) => {
    if (name === normalizedQuery) return 0;
    if (name.startsWith(normalizedQuery)) return 1;
    if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) return 2;
    return 3;
  };

  return Array.from(index, ([normalizedName, entry]) => ({
    name: entry.name,
    normalizedName,
    mealCount: entry.mealIds.size,
  })).sort((a, b) =>
    matchStrength(a.normalizedName) - matchStrength(b.normalizedName) ||
    b.mealCount - a.mealCount ||
    a.name.localeCompare(b.name)
  );
};

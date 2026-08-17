import {
  formatSharedIngredientPreview,
  getIngredientOverlap,
  normalizeIngredientName,
  rankMealsByIngredientOverlap,
} from "../utils/ingredientOverlap";
import { Meal } from "../types/meals";

const meal = (id: string, ingredients: Meal["ingredients"]): Meal => ({
  id,
  title: id,
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  ingredients,
});

describe("ingredient overlap", () => {
  it("normalizes casing, spacing, and simple plural differences", () => {
    expect(normalizeIngredientName("  Chicken   Breasts ")).toBe(
      "chicken breast",
    );
  });

  it("matches key ingredients across the full week and ignores pantry staples", () => {
    const planned = [
      meal("ramen", [
        { name: "Chicken Breast", category: "meat", ingredientType: "keyIngredient" },
        { name: "Kosher Salt", category: "spices", ingredientType: "pantryStaple" },
      ]),
      meal("stir-fry", [
        { name: "Carrots", category: "produce", ingredientType: "keyIngredient" },
      ]),
    ];
    const overlap = getIngredientOverlap(
      meal("candidate", [
        { name: "chicken breasts", category: "meat", ingredientType: "keyIngredient" },
        { name: "Carrot", category: "produce", ingredientType: "keyIngredient" },
        { name: "Kosher Salt", category: "spices", ingredientType: "pantryStaple" },
      ]),
      planned,
    );

    expect(overlap.sharedIngredients).toEqual(["chicken breasts", "Carrot"]);
    expect(overlap.sharedCount).toBe(2);
    expect(overlap.candidateIngredientCount).toBe(2);
  });

  it("requires two matches and blends count with overlap efficiency", () => {
    const planned = [meal("planned", ["Chicken", "Carrots", "Garlic", "Onion"])];
    const efficient = meal("efficient", ["Chicken", "Carrots", "Garlic", "Rice"]);
    const broad = meal("broad", [
      "Chicken",
      "Carrots",
      "Garlic",
      "Onion",
      "Broccoli",
      "Noodles",
      "Peas",
      "Corn",
      "Cheese",
      "Milk",
      "Butter",
      "Beans",
    ]);
    const weak = meal("weak", ["Chicken", "Potatoes"]);

    expect(rankMealsByIngredientOverlap([broad, weak, efficient], planned).map(({ meal }) => meal.id)).toEqual([
      "efficient",
      "broad",
    ]);
    expect(formatSharedIngredientPreview(["Chicken", "Carrots", "Garlic", "Onion", "Peas"])).toBe(
      "Chicken · Carrots · Garlic · Onion +1",
    );
  });
});

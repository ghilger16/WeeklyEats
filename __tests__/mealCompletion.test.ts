import { Ingredient, Meal } from "../types/meals";
import {
  isMealIncomplete,
  mergeConfirmedIngredients,
} from "../utils/mealCompletion";

const createMeal = (ingredients: Meal["ingredients"] = []): Meal => ({
  id: "meal",
  title: "Tacos",
  emoji: "🌮",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  ingredients,
  difficulty: 1,
  expense: 1,
});

describe("meal completion", () => {
  it("only considers meaningful key ingredient data complete", () => {
    expect(isMealIncomplete(createMeal())).toBe(true);
    expect(
      isMealIncomplete(
        createMeal([
          { name: "Salt", category: "spices", ingredientType: "pantryStaple" },
        ])
      )
    ).toBe(true);
    expect(isMealIncomplete(createMeal(["Chicken"]))).toBe(false);
    expect(
      isMealIncomplete(
        createMeal([
          { name: "Chicken", category: "meat", ingredientType: "keyIngredient" },
        ])
      )
    ).toBe(false);
  });

  it("treats missing difficulty or expense as incomplete", () => {
    const completeMeal = createMeal(["Chicken"]);
    expect(isMealIncomplete({ ...completeMeal, difficulty: undefined })).toBe(true);
    expect(isMealIncomplete({ ...completeMeal, expense: undefined })).toBe(true);
    expect(isMealIncomplete(completeMeal)).toBe(false);
  });

  it("preserves existing ingredients and de-duplicates confirmed values", () => {
    const confirmed: Ingredient[] = [
      { name: "chicken", category: "meat", ingredientType: "keyIngredient" },
      { name: "Tortillas", category: "bakery", ingredientType: "keyIngredient" },
    ];
    expect(mergeConfirmedIngredients(["Chicken"], confirmed)).toEqual([
      "Chicken",
      confirmed[1],
    ]);
  });
});

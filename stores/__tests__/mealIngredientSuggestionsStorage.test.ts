jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCachedMealIngredientSuggestions,
  setCachedMealIngredientSuggestions,
} from "../mealIngredientSuggestionsStorage";

describe("meal ingredient suggestion cache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("persists suggestions per meal and title", async () => {
    await setCachedMealIngredientSuggestions("meal-1", "Chicken Tacos", [
      { name: "Chicken", category: "meat", ingredientType: "keyIngredient" },
      { name: "Cumin", category: "spices", ingredientType: "pantryStaple" },
    ]);

    await expect(
      getCachedMealIngredientSuggestions("meal-1", "Chicken Tacos"),
    ).resolves.toEqual([
      { name: "Chicken", category: "meat", ingredientType: "keyIngredient" },
      { name: "Cumin", category: "spices", ingredientType: "pantryStaple" },
    ]);
  });

  it("invalidates cached suggestions when the meal title changes", async () => {
    await setCachedMealIngredientSuggestions("meal-1", "Chicken Tacos", [
      { name: "Chicken", category: "meat", ingredientType: "keyIngredient" },
    ]);

    await expect(
      getCachedMealIngredientSuggestions("meal-1", "Fish Tacos"),
    ).resolves.toBeNull();
  });

  it("does not lose entries when multiple meals are cached together", async () => {
    await Promise.all([
      setCachedMealIngredientSuggestions("meal-1", "Tacos", [
        { name: "Tortillas", category: "bakery", ingredientType: "keyIngredient" },
      ]),
      setCachedMealIngredientSuggestions("meal-2", "Pasta", [
        { name: "Pasta", category: "pastaAndRice", ingredientType: "keyIngredient" },
      ]),
    ]);

    await expect(getCachedMealIngredientSuggestions("meal-1", "Tacos")).resolves.toHaveLength(1);
    await expect(getCachedMealIngredientSuggestions("meal-2", "Pasta")).resolves.toHaveLength(1);
  });
});

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getIngredientOverlap } from "../ingredientOverlap";
import { Meal } from "../../types/meals";

describe("ingredient classification", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("classifies built-in staples and safely defaults unknown ingredients", async () => {
    const { classifyIngredientType } = require("../ingredientClassification");

    await expect(classifyIngredientType("  CUMIN ")).resolves.toBe(
      "pantryStaple",
    );
    await expect(classifyIngredientType("Ground   beef")).resolves.toBe(
      "keyIngredient",
    );
  });

  it("lets a persisted household preference override built-in and imported types", async () => {
    const classification = require("../ingredientClassification");
    await classification.setIngredientClassificationPreference(
      "Soy Sauce",
      "keyIngredient",
    );

    await expect(
      classification.classifyIngredientType(" soy   sauce ", "pantryStaple"),
    ).resolves.toBe("keyIngredient");
    await expect(
      classification.classifyIngredientType("Tortillas", "pantryStaple"),
    ).resolves.toBe("pantryStaple");
    await expect(
      AsyncStorage.getItem(
        "weekly-eats:ingredient-classification-preferences:v1",
      ),
    ).resolves.toContain('"soy sauce":"key"');
  });

  it("keeps pantry staples out of meaningful shared-ingredient counts", () => {
    const createMeal = (id: string, protein: string): Meal => ({
      id,
      title: id,
      emoji: "🍽️",
      rating: 0,
      servedCount: 0,
      showServedCount: false,
      plannedCostTier: 2,
      locked: false,
      isFavorite: false,
      ingredients: [
        { name: protein, category: "meat", ingredientType: "keyIngredient" },
        { name: "Broccoli", category: "produce", ingredientType: "keyIngredient" },
        { name: "Salt", category: "spices", ingredientType: "pantryStaple" },
        { name: "Pepper", category: "spices", ingredientType: "pantryStaple" },
      ],
    });

    expect(
      getIngredientOverlap(createMeal("beef", "Beef"), [
        createMeal("chicken", "Chicken"),
      ]).sharedIngredients,
    ).toEqual(["Broccoli"]);
  });
});

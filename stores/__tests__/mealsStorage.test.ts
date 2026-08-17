jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMeals, mealsStorageKey } from "../mealsStorage";

describe("mealsStorage preferred sides migration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("migrates legacy suggestedSides into preferredSides without duplicates", async () => {
    await AsyncStorage.setItem(
      mealsStorageKey,
      JSON.stringify([
        {
          id: "tacos",
          title: "Tacos",
          emoji: "🌮",
          suggestedSides: [" Corn ", "corn", "Black Beans"],
        },
      ]),
    );

    const [meal] = await getMeals();

    expect(meal.preferredSides).toEqual(["Corn", "Black Beans"]);
    expect("suggestedSides" in meal).toBe(false);
  });
});

import {
  getSideOptionsForMeal,
  replaceSideWithCustomOption,
  SideOption,
} from "../components/plan-week/inline/sideOptions";
import { Meal } from "../types/meals";

const meal: Meal = {
  id: "meal",
  title: "Meal",
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 1,
  locked: false,
  isFavorite: false,
};

describe("inline side options", () => {
  it("always produces six unique options and starts with existing sides", () => {
    const options = getSideOptionsForMeal(meal, ["Rice", "rice", "Broccoli"]);

    expect(options).toHaveLength(6);
    expect(options.slice(0, 2).map((option) => option.name)).toEqual([
      "Broccoli",
      "Rice",
    ]);
    expect(new Set(options.map((option) => option.name.toLowerCase())).size).toBe(6);
  });

  it("prepends a custom option, trims the final option, and selects it", () => {
    const options: SideOption[] = ["A", "B", "C", "D", "E", "F"].map(
      (name) => ({ name, isCustom: false }),
    );
    const result = replaceSideWithCustomOption(options, ["A", "F"], " Egg Rolls ");

    expect(result?.options.map((option) => option.name)).toEqual([
      "Egg Rolls",
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(result?.selectedSides).toEqual(["A", "Egg Rolls"]);
  });

  it("rejects case-insensitive duplicates", () => {
    const options: SideOption[] = ["Rice", "B", "C", "D", "E", "F"].map(
      (name) => ({ name, isCustom: false }),
    );

    expect(replaceSideWithCustomOption(options, [], " rice ")).toBeNull();
  });

  it("rejects blank and whitespace-only custom sides", () => {
    const options = getSideOptionsForMeal(meal);

    expect(replaceSideWithCustomOption(options, [], "")).toBeNull();
    expect(replaceSideWithCustomOption(options, [], "   ")).toBeNull();
  });

  it("keeps the newest custom option first when all six are custom", () => {
    const options: SideOption[] = ["A", "B", "C", "D", "E", "F"].map(
      (name) => ({ name, isCustom: true }),
    );
    const result = replaceSideWithCustomOption(options, ["B", "C"], "G");

    expect(result?.options.map((option) => option.name)).toEqual([
      "G",
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(result?.options).toHaveLength(6);
  });

  it("loads saved custom sides before standard suggestions", () => {
    const options = getSideOptionsForMeal(meal, [
      "Rice",
      "Corn",
      "Mac and Cheese",
      "Salad",
    ]);

    expect(options.slice(0, 4).map((option) => option.name)).toEqual([
      "Corn",
      "Mac and Cheese",
      "Rice",
      "Salad",
    ]);
    expect(options).toHaveLength(6);
  });

});

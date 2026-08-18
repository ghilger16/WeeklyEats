import { compareMealTitles } from "../mealTitleMatch";

describe("compareMealTitles", () => {
  it.each([
    ["Burgers", "Classic Smash Burgers"],
    ["Tacos", "Ground Beef Tacos"],
    ["Spaghetti", "Spaghetti & Meatballs"],
    ["Pizza", "Homemade Pepperoni Pizza"],
  ])("treats %s and %s as the same general meal", (existing, detected) => {
    expect(compareMealTitles(existing, detected)?.matches).toBe(true);
  });

  it.each([
    ["Burgers", "Creamy Chicken Alfredo"],
    ["Chili", "Lasagna"],
  ])("flags %s and %s as confidently different", (existing, detected) => {
    const result = compareMealTitles(existing, detected);
    expect(result?.matches).toBe(false);
    expect(result?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("does not flag an ambiguous comparison", () => {
    expect(compareMealTitles("Sunday Dinner", "Roast Chicken")).toBeNull();
  });
});

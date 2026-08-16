import { Meal } from "../types/meals";
import { getGalaxyMealId } from "../utils/galaxyMeal";

const meal = (
  id: string,
  servedCount: number,
  familyRatings: Meal["familyRatings"]
): Meal => ({
  id,
  title: id,
  emoji: "🍽️",
  rating: 0,
  familyRatings,
  servedCount,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
});

describe("Galaxy Meal", () => {
  const members = ["one", "two"];
  const familyStarRatings = { one: 3 as const, two: 3 as const };

  it("requires at least five servings", () => {
    expect(getGalaxyMealId([meal("tacos", 4, familyStarRatings)], members)).toBeNull();
    expect(getGalaxyMealId([meal("tacos", 5, familyStarRatings)], members)).toBe("tacos");
  });

  it("chooses the most-served Family Star rather than the most-served meal overall", () => {
    expect(
      getGalaxyMealId(
        [
          meal("not-a-star", 20, { one: 2, two: 2 }),
          meal("star", 7, familyStarRatings),
          meal("other-star", 5, familyStarRatings),
        ],
        members
      )
    ).toBe("star");
  });

  it("does not create a Galaxy Meal without a family rating group", () => {
    expect(getGalaxyMealId([meal("solo", 10, { one: 3 })], ["one"])).toBeNull();
  });
});

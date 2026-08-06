import { getUsualMealsForDay } from "../components/plan-week/inline/getUsualMealsForDay";
import { ServedMealEntry } from "../stores/servedMealsStorage";
import { Meal } from "../types/meals";

const meal = (id: string, overrides: Partial<Meal> = {}): Meal => ({
  id,
  title: id,
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 1,
  locked: false,
  isFavorite: false,
  ...overrides,
});

const served = (mealId: string, dayKey: ServedMealEntry["dayKey"], servedAtISO: string): ServedMealEntry => ({
  id: `${mealId}-${servedAtISO}`,
  mealId,
  dayKey,
  servedAtISO,
  outcome: "served",
});

describe("getUsualMealsForDay", () => {
  it("prioritizes meals repeatedly served on the selected weekday", () => {
    const meals = [meal("favorite", { isFavorite: true, rating: 5 }), meal("monday"), meal("other")];
    const history = [
      served("monday", "mon", "2026-07-13T18:00:00.000Z"),
      served("monday", "mon", "2026-07-06T18:00:00.000Z"),
      served("other", "tue", "2026-07-14T18:00:00.000Z"),
    ];

    expect(getUsualMealsForDay("mon", meals, history)[0].id).toBe("monday");
  });

  it("falls back to favorites and rating without returning special plan records", () => {
    const meals = [
      meal("ordinary", { rating: 4 }),
      meal("favorite", { isFavorite: true, rating: 3 }),
      meal("__eat_out__", { isFavorite: true, rating: 5 }),
    ];

    expect(getUsualMealsForDay("fri", meals, []).map((item) => item.id)).toEqual([
      "favorite",
      "ordinary",
    ]);
  });
});

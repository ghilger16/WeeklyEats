import { getSmartLevel } from "../utils/smartLevel";
import { Meal } from "../types/meals";

const meal = (id: string, values: Partial<Meal> = {}): Meal => ({
  id,
  title: id,
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  ...values,
});

const servedEntries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${index}`,
    dayKey: "mon" as const,
    mealId: `meal-${index}`,
    servedAtISO: new Date(2026, 0, index + 1).toISOString(),
    outcome: "served" as const,
  }));

describe("getSmartLevel", () => {
  it("starts at level one", () => {
    expect(getSmartLevel({ meals: [], servedEntries: [], plannedWeeksCount: 0 })).toBe(1);
  });

  it("requires details plus real planning or serving for level two", () => {
    const meals = [meal("one", { cuisine: "american" })];
    expect(getSmartLevel({ meals, servedEntries: [], plannedWeeksCount: 0 })).toBe(1);
    expect(getSmartLevel({ meals, servedEntries: [], plannedWeeksCount: 1 })).toBe(2);
  });

  it("uses ratings and served history for level three", () => {
    const meals = [1, 2, 3].map((id) => meal(`${id}`, { rating: 5 }));
    expect(getSmartLevel({ meals, servedEntries: servedEntries(5), plannedWeeksCount: 1 })).toBe(3);
  });

  it("requires sustained history and complete profiles for level five", () => {
    const meals = Array.from({ length: 8 }, (_, index) =>
      meal(`${index}`, { rating: 5, cuisine: "american", difficulty: 2, expense: 2 }),
    );
    expect(getSmartLevel({ meals, servedEntries: servedEntries(25), plannedWeeksCount: 8 })).toBe(5);
  });
});

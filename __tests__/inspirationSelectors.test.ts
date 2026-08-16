import {
  getBeenAwhileMeals,
  getBudgetMeals,
  getEasyMeals,
  getCuisineMeals,
  getRecentlyAddedUnservedMeals,
} from "../components/plan-week/inspirationSelectors";
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

describe("inspiration selectors", () => {
  it("puts never-served and oldest-served meals first", () => {
    const meals = [meal("recent"), meal("never"), meal("old")];
    const history = [
      { id: "1", dayKey: "mon" as const, mealId: "recent", servedAtISO: "2026-07-28T18:00:00.000Z", outcome: "served" as const },
      { id: "2", dayKey: "mon" as const, mealId: "old", servedAtISO: "2026-06-01T18:00:00.000Z", outcome: "served" as const },
    ];
    expect(getBeenAwhileMeals(meals, history).map((item) => item.id)).toEqual([
      "never",
      "old",
      "recent",
    ]);
  });

  it("filters easy and budget meals using existing fields", () => {
    const meals = [
      meal("easy-budget", { difficulty: 2, expense: 1 }),
      meal("hard", { difficulty: 5, expense: 2 }),
      meal("pricey", { difficulty: 1, expense: 5 }),
    ];
    expect(getEasyMeals(meals).map((item) => item.id)).toEqual([
      "easy-budget",
      "pricey",
    ]);
    expect(getBudgetMeals(meals).map((item) => item.id)).toEqual([
      "easy-budget",
      "hard",
    ]);
  });

  it("filters cuisine inspiration to meals with a selected cuisine", () => {
    const meals = [
      meal("tacos", { cuisine: "mexican" }),
      meal("pasta", { cuisine: "italian" }),
      meal("unset"),
    ];
    expect(getCuisineMeals(meals).map((item) => item.id)).toEqual([
      "tacos",
      "pasta",
    ]);
    expect(getCuisineMeals(meals, "mexican").map((item) => item.id)).toEqual([
      "tacos",
    ]);
  });

  it("returns only unserved meals added within the last 30 days", () => {
    const now = new Date("2026-08-10T12:00:00.000Z").getTime();
    const meals = [
      meal("newest", { createdAt: "2026-08-09T12:00:00.000Z" }),
      meal("recent", { createdAt: "2026-07-20T12:00:00.000Z" }),
      meal("served-history", { createdAt: "2026-08-08T12:00:00.000Z" }),
      meal("served-count", { createdAt: "2026-08-07T12:00:00.000Z", servedCount: 1 }),
      meal("old", { createdAt: "2026-06-01T12:00:00.000Z" }),
    ];
    const history = [
      {
        id: "served-1",
        dayKey: "mon" as const,
        mealId: "served-history",
        servedAtISO: "2026-08-09T18:00:00.000Z",
        outcome: "served" as const,
      },
    ];

    expect(
      getRecentlyAddedUnservedMeals(meals, history, now).map((item) => item.id),
    ).toEqual(["newest", "recent"]);
  });
});

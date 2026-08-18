import {
  buildWeekPlanCelebration,
  classifyWeekEffort,
  classifyWeekExpense,
} from "../weekPlanCelebration";
import { Meal } from "../../types/meals";
import { createEmptyCurrentPlannedWeek } from "../../types/weekPlan";

const meal = (overrides: Partial<Meal>): Meal => ({
  id: "meal-1",
  title: "Dinner",
  emoji: "🍽️",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  ...overrides,
});

describe("week plan celebration", () => {
  it("classifies known effort and expense without exposing averages", () => {
    expect(classifyWeekEffort([1, 1, 2])).toBe("Easy");
    expect(classifyWeekEffort([2, 2, 3])).toBe("Balanced");
    expect(classifyWeekEffort([3, 3])).toBe("Cook-heavy");
    expect(classifyWeekExpense([1, 1])).toBe("Budget-friendly");
    expect(classifyWeekExpense([2, 2])).toBe("Balanced");
    expect(classifyWeekExpense([3, 3])).toBe("Treat week");
  });

  it("builds dynamic stats and uses served history for new meals", () => {
    const plan = createEmptyCurrentPlannedWeek();
    plan.mon = "star";
    plan.tue = "new";
    plan.wed = "served-before";
    const payload = buildWeekPlanCelebration({
      plan,
      meals: [
        meal({ id: "star", familyRatings: { one: 3, two: 3 }, difficulty: 1, expense: 1 }),
        meal({ id: "new", difficulty: 2, expense: 2 }),
        meal({ id: "served-before", difficulty: 2 }),
      ],
      servedMealIds: new Set(["served-before"]),
      streakCount: 4,
    });

    expect(payload.dinnerCount).toBe(3);
    expect(payload.streakCount).toBe(4);
    expect(payload.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "familyStars", value: "1", label: "Family Star" }),
        expect.objectContaining({ id: "newMeals", value: "2", label: "New Meals" }),
        expect.objectContaining({ id: "effort", value: "Balanced" }),
        expect.objectContaining({ id: "expense", value: "Budget", label: "Friendly" }),
      ]),
    );
  });

  it("omits classifications when too little plan data is known", () => {
    const plan = createEmptyCurrentPlannedWeek();
    plan.mon = "one";
    plan.tue = "two";
    plan.wed = "three";
    plan.thu = "four";
    const payload = buildWeekPlanCelebration({
      plan,
      meals: [
        meal({ id: "one", difficulty: 1 }),
        meal({ id: "two" }),
        meal({ id: "three" }),
        meal({ id: "four" }),
      ],
      servedMealIds: new Set(),
      streakCount: 1,
    });
    expect(payload.stats.some((stat) => stat.id === "effort")).toBe(false);
    expect(payload.stats.some((stat) => stat.id === "expense")).toBe(false);
  });

  it("uses the simple rating for the Five Star stat in Star Ratings mode", () => {
    const plan = createEmptyCurrentPlannedWeek();
    plan.mon = "five-star";
    plan.tue = "family-star-only";
    const payload = buildWeekPlanCelebration({
      plan,
      meals: [
        meal({ id: "five-star", rating: 5 }),
        meal({ id: "family-star-only", rating: 0, familyRatings: { one: 3, two: 3 } }),
      ],
      servedMealIds: new Set(),
      streakCount: 1,
      ratingStyle: "summary",
    });

    expect(payload.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fiveStars", value: "1", label: "Five Star" }),
      ]),
    );
    expect(payload.stats.some((stat) => stat.id === "familyStars")).toBe(false);
  });
});

import { buildWeekPlanCelebration } from "../weekPlanCelebration";
import { Meal } from "../../types/meals";
import { createEmptyCurrentPlannedWeek, PLANNED_WEEK_ORDER } from "../../types/weekPlan";
import { FLEX_NIGHT_MEAL_ID } from "../../types/specialMeals";
import type { ServedMealEntry } from "../../stores/servedMealsStorage";
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
const now = Date.parse("2026-09-14T12:00:00Z");
const meal = (id: string, overrides: Partial<Meal> = {}): Meal => ({ id, title: id, emoji: "🍽️", rating: 0, servedCount: 0, showServedCount: false, plannedCostTier: 3, locked: false, isFavorite: false, ...overrides });
const build = (meals: Meal[], ids = meals.map(m => m.id), history: ServedMealEntry[] = [], ratingStyle: "family" | "summary" = "family") => {
  const plan = createEmptyCurrentPlannedWeek();
  ids.forEach((id, i) => { plan[PLANNED_WEEK_ORDER[i]] = id; });
  return buildWeekPlanCelebration({ plan, meals, history, streakCount: 4, now, ratingStyle });
};
it("chooses dinners, favorites, and been-awhile before lower priority stats", () => {
  const result = build([meal("old", { familyRatings: { a: 3, b: 3 }, createdAt: "2026-07-01", difficulty: 1, expense: 1 }), meal("easy", { difficulty: 1 })], undefined, [{ mealId: "old", outcome: "served", servedAtISO: "2026-07-01T00:00:00Z" }] as ServedMealEntry[]);
  expect(result.stats.map(s => s.id)).toEqual(["dinners", "favorites", "beenAwhile"]);
  expect(result.stats.map(s => s.value)).toEqual(["2", "1", "1"]);
  expect(result.streakCount).toBe(4);
});
it("uses latest served history for been-awhile", () => {
  const history = [{ mealId: "old", outcome: "served", servedAtISO: "2026-09-13T12:00:00Z" }] as ServedMealEntry[];
  expect(build([meal("old", { createdAt: "2026-07-01" })], undefined, history).stats.some(s => s.id === "beenAwhile")).toBe(false);
});
it("counts easy meals and full freezer inventory using the existing rules", () => {
  const result = build([meal("a", { difficulty: 1, freezerMealAmount: 1 }), meal("b", { difficulty: 3, freezerMealAmount: 0.5 })]);
  expect(result.stats.map(s => [s.id, s.value])).toEqual([["dinners", "2"], ["easy", "1"], ["freezer", "1"]]);
});
it("ranks flex nights ahead of budget and excludes special days from meal classifiers", () => {
  expect(build([meal("budget", { expense: 2 })], ["budget", FLEX_NIGHT_MEAL_ID]).stats.map(s => s.id)).toEqual(["dinners", "flex", "budget"]);
});
it("counts canonical shared ingredients once, ignoring pantry staples", () => {
  const result = build([meal("a", { ingredients: [{ name: "Frozen Corn", category: "frozen", ingredientType: "keyIngredient" }, { name: "Butter", category: "dairy", ingredientType: "pantryStaple" }] }), meal("b", { ingredients: [{ name: "Corn Kernels", category: "produce", ingredientType: "keyIngredient" }, { name: "Butter", category: "dairy", ingredientType: "pantryStaple" }] })]);
  expect(result.stats.map(s => [s.id, s.value])).toEqual([["dinners", "2"], ["shared", "1"]]);
});
it("falls back without zeros, repeated stats, or invented third metrics", () => {
  expect(build([meal("unknown")]).stats.map(s => s.id)).toEqual(["dinners"]);
  expect(build([]).stats).toEqual([]);
  expect(build([meal("unknown")], ["missing"]).dinnerCount).toBe(0);
});
it("counts repeated meal assignments and respects star-rating mode", () => {
  const result = build([meal("a", { rating: 5, difficulty: 1 }), meal("b", { familyRatings: { x: 3 } })], ["a", "a", "b"], [], "summary");
  expect(result.stats.map(s => [s.id, s.value])).toEqual([["dinners", "3"], ["favorites", "2"], ["easy", "2"]]);
  expect(result.stats.every(s => !/decision/i.test(s.label))).toBe(true);
});

it("does not count medium, legacy intermediate, or missing difficulty as easy", () => {
  const result = build([meal("easy", { difficulty: 1 }), meal("medium", { difficulty: 3 }), meal("legacy", { difficulty: 2 }), meal("unknown")]);
  expect(result.stats.find(s => s.id === "easy")?.value).toBe("1");
});
it("does not infer budget from cost tier or familiarity from creation date", () => {
  const result = build([meal("unknown", { plannedCostTier: 1, createdAt: "2020-01-01", rating: 5 })]);
  expect(result.stats.map(s => s.id)).toEqual(["dinners"]);
});
it("does not round a partial freezer meal into a full one", () => {
  expect(build([meal("partial", { freezerMealAmount: 0.9 })]).stats.map(s => s.id)).toEqual(["dinners"]);
});

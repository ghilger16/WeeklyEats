jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { buildAutoPlan } from "../components/plan-week/autoPlan";
import { getRecencyScore, getSharedIngredientBonus, getWeekdayCuisineAffinity, getWholeWeekPenalty } from "../components/plan-week/autoPlanScoring";
import { buildMealSuggestions } from "../components/plan-week/suggestions/suggestionMatcher";
import { getAutoPlanSideState } from "../components/plan-week/autoPlanSides";
import { createEmptyDayPinsMap, createEmptyDayPinsState } from "../types/dayPins";
import { createEmptyCurrentPlannedWeek, PlannedWeekDayKey } from "../types/weekPlan";
import { createEmptyMealDraft, Meal } from "../types/meals";
import { ServedMealEntry } from "../stores/servedMealsStorage";
import { getFamilyRatingScore } from "../utils/familyRatings";
import { DAY_MS, getLatestServedDates } from "../utils/servingHistory";

const now = Date.parse("2026-10-28T12:00:00Z");
const meal = (id: string, values: Partial<Meal> = {}): Meal => ({ ...createEmptyMealDraft(), id, title: id, ...values });
const served = (mealId: string, daysAgo: number, dayKey: PlannedWeekDayKey = "tue", outcome: ServedMealEntry["outcome"] = "served"): ServedMealEntry => ({
  id: `${mealId}-${daysAgo}`, mealId, dayKey, outcome,
  servedAtISO: new Date(now - daysAgo * DAY_MS).toISOString(),
});
const plan = (meals: Meal[], overrides: Partial<Parameters<typeof buildAutoPlan>[0]> = {}) => buildAutoPlan({
  days: ["tue"], meals, plannedWeek: createEmptyCurrentPlannedWeek(),
  dayPinsMap: createEmptyDayPinsMap(), servedEntries: [], now, random: () => 0.5,
  ...overrides,
});
const mexican = meal("tacos", { cuisine: "mexican" });
const italian = meal("pasta", { cuisine: "italian" });
const american = meal("burgers", { cuisine: "american" });
const cuisineMeals = [mexican, italian, american];

it("repeat timing uses the latest real serving, never the edit date", () => {
  const pins = { ...createEmptyDayPinsState(), reuseWeeks: 2 as const };
  const recentEdit = meal("old", { updatedAt: new Date(now).toISOString() });
  const oldEdit = meal("recent", { updatedAt: "2020-01-01" });
  const never = meal("never", { updatedAt: new Date(now).toISOString() });
  const history = [served("old", 30), served("recent", 50), served("recent", 1), served("never", 0, "tue", "skipped")];
  const result = buildMealSuggestions([recentEdit, oldEdit, never], pins, undefined, history, now);
  expect(result.find(x => x.meal.id === "old")?.breakdown.repeatTiming).toBe(20);
  expect(result.find(x => x.meal.id === "recent")?.breakdown.repeatTiming).toBe(-25);
  expect(result.find(x => x.meal.id === "never")?.breakdown.repeatTiming).toBe(20);
});

it("ignores invalid, future and non-served history", () => {
  const history = [served("valid", 8), served("future", -1), served("skipped", 1, "tue", "skipped"), { ...served("invalid", 1), servedAtISO: "invalid" }];
  expect([...getLatestServedDates(history, now).keys()]).toEqual(["valid"]);
});

it("does not count Medium or missing difficulty as Easy", () => {
  const pins = { ...createEmptyDayPinsState(), effort: "easy" as const };
  expect(buildMealSuggestions([meal("easy", { difficulty: 2 }), meal("medium", { difficulty: 3 }), meal("unknown")], pins).map(x => x.meal.id)).toEqual(["easy"]);
});

it("effort follows the actual day's pins even when shopping starts Saturday", () => {
  const pins = createEmptyDayPinsMap();
  pins.sat.effort = "hard";
  pins.sun.effort = "easy";
  const result = plan([meal("easy", { difficulty: 1 }), meal("hard", { difficulty: 5 })], { days: ["sat", "sun"], dayPinsMap: pins });
  expect(result.map(x => [x.day, x.meal.id])).toEqual([["sat", "hard"], ["sun", "easy"]]);
  expect(result[1].scoreBreakdown.settings).toBe(25);
});

it("adds no arbitrary easy bonus when no effort preference is set", () => {
  const easy = plan([meal("easy", { difficulty: 1 })])[0];
  const medium = plan([meal("medium", { difficulty: 3 })])[0];
  expect(easy.scoreBreakdown.total).toBe(medium.scoreBreakdown.total);
});

it("applies type exclusions before inclusion bonuses, including hybrid titles", () => {
  const pins = createEmptyDayPinsMap();
  pins.tue.types = ["tacos"];
  pins.tue.excludedTypes = ["pasta"];
  const result = plan([meal("hybrid", { title: "Taco Pasta", rating: 5 }), meal("taco", { title: "Beef Tacos" })], { dayPinsMap: pins });
  expect(result[0].meal.id).toBe("taco");
  expect(result[0].scoreBreakdown.settings).toBe(15);
});

it.each([
  ["pasta", "Baked Rigatoni"], ["soup", "Chicken Soup"], ["tacos", "Fish Tacos"],
  ["salad", "Greek Salad"], ["one_pot", "One-Pan Chicken"],
] as const)("recognizes the existing %s type", (type, title) => {
  expect(buildMealSuggestions([meal("match", { title })], { ...createEmptyDayPinsState(), excludedTypes: [type] })).toHaveLength(0);
});

it("rewards unique canonical shared ingredients, capped at four", () => {
  const ingredients = ["Ground Beef", "Cheese", "Onion", "Onions", "Tomato", "Carrot", "Potato"];
  expect(getSharedIngredientBonus(meal("new", { ingredients }), [meal("old", { ingredients }), meal("old2", { ingredients })])).toBe(4);
  expect(getSharedIngredientBonus(meal("new", { ingredients: ["Onion", "Onions", " onion "] }), [meal("old", { ingredients: ["onions"] })])).toBe(1);
  expect(plan([meal("new", { ingredients: ["Onion"] }), meal("old", { ingredients: ["Onions"] })], { plannedWeek: { ...createEmptyCurrentPlannedWeek(), mon: "old" } })[0].scoreBreakdown.ingredientOverlap).toBe(1);
});

it("does not count pantry staples", () => {
  const ingredients: Meal["ingredients"] = ["salt", "black pepper", "olive oil", { name: "Cheese", category: "dairy", ingredientType: "pantryStaple" }];
  expect(getSharedIngredientBonus(meal("new", { ingredients }), [meal("old", { ingredients })])).toBe(0);
});

it("learns a strong Tuesday Mexican pattern from actual servings", () => {
  const history = [1, 8, 15, 22].map(days => served("tacos", days));
  expect(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, history, now)).toBeGreaterThan(6);
  expect(getWeekdayCuisineAffinity("wed", "mexican", cuisineMeals, history, now)).toBe(0);
  const freshMexican = meal("new mexican", { cuisine: "mexican" });
  expect(plan([...cuisineMeals, freshMexican], { servedEntries: history })[0].meal.id).toBe("new mexican");
});

it("keeps sparse and mixed cuisine patterns weak", () => {
  expect(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, [served("tacos", 1)], now)).toBeLessThan(2.5);
  const mixed = [served("tacos", 1), served("pasta", 8), served("burgers", 15)];
  expect(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, mixed, now)).toBeLessThan(2);
});

it("weights recent history more heavily and drops history older than eight weeks", () => {
  const affinity = (ages: number[]) => getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, ages.map(d => served("tacos", d)), now);
  expect(affinity([1, 8, 15])).toBeGreaterThan(affinity([29, 36, 43]));
  expect(affinity([57, 64, 71])).toBe(0);
});

it("does not infer cuisine from skipped meals, deleted meals, other cuisine or duplicate logs", () => {
  expect(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, [served("tacos", 1, "tue", "skipped")], now)).toBe(0);
  const one = served("tacos", 1);
  expect(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, [one, one], now)).toBe(getWeekdayCuisineAffinity("tue", "mexican", cuisineMeals, [one], now));
  expect(getWeekdayCuisineAffinity("tue", "mexican", [], [one], now)).toBe(0);
  expect(getWeekdayCuisineAffinity("tue", "other", cuisineMeals, [one], now)).toBe(0);
});

it("explicit effort and expense filters override learned cuisine affinity", () => {
  const pins = createEmptyDayPinsMap();
  pins.tue.effort = "easy";
  pins.tue.expense = "$";
  const history = [1, 8, 15, 22].map(days => served("tacos", days));
  const meals = [mexican, meal("hard", { cuisine: "mexican", difficulty: 5, expense: 2 }), meal("expensive", { cuisine: "mexican", difficulty: 1, expense: 6 }), meal("eligible", { cuisine: "italian", difficulty: 1, expense: 2 })];
  expect(plan(meals, { dayPinsMap: pins, servedEntries: history })[0].meal.id).toBe("eligible");
});

it("keeps freezer requirements hard", () => {
  const pins = createEmptyDayPinsMap(); pins.tue.freezerNight = true;
  const result = plan([meal("fresh", { rating: 5 }), meal("frozen", { freezerMealAmount: 1 })], { dayPinsMap: pins });
  expect(result.map(x => x.meal.id)).toEqual(["frozen"]);
});

it("repeat timing outweighs a strong cuisine habit", () => {
  const pins = createEmptyDayPinsMap(); pins.tue.reuseWeeks = 2;
  const history = [1, 8, 15, 22].map(days => served("tacos", days));
  expect(plan([mexican, italian], { dayPinsMap: pins, servedEntries: history })[0].meal.id).toBe("pasta");
});

it("uses proportional family ratings without treating unrated people as dislikes", () => {
  expect(getFamilyRatingScore(meal("loved", { familyRatings: { a: 3, b: 3 } }))).toBe(12);
  expect(getFamilyRatingScore(meal("liked", { familyRatings: { a: 3, b: 2 } }))).toBe(9);
  expect(getFamilyRatingScore(meal("mixed", { familyRatings: { a: 3, b: 1 } }))).toBe(0);
  expect(getFamilyRatingScore(meal("disliked", { familyRatings: { a: 1 } }))).toBe(-12);
  expect(getFamilyRatingScore(meal("unrated", { familyRatings: { a: 0 } }))).toBe(0);
  expect(getFamilyRatingScore(meal("partial", { familyRatings: { a: 2, b: 0 } }))).toBe(6);
});

it("breaks only exact ties randomly without alphabetical preference", () => {
  const meals = [meal("A"), meal("Z")];
  let i = 0;
  expect(plan(meals, { random: () => ++i % 2 ? 0.1 : 0.9 })[0].meal.id).toBe("Z");
  i = 0;
  expect(plan(meals, { random: () => ++i % 2 ? 0.9 : 0.1 })[0].meal.id).toBe("A");
  i = 0;
  expect(plan([meal("A", { rating: 5 }), meal("Z", { rating: 4 })], { random: () => ++i % 2 ? 0 : 1 })[0].meal.id).toBe("A");
});

it("Try Another penalizes previous suggestions and produces a different valid plan", () => {
  const meals = [meal("A"), meal("B"), meal("C"), meal("D")];
  const first = plan(meals, { days: ["tue", "wed"] });
  const next = plan(meals, { days: ["tue", "wed"], previousGeneratedMealIds: new Set(first.map(x => x.meal.id)) });
  expect(next.map(x => x.meal.id).some(id => first.some(x => x.meal.id === id))).toBe(false);
  expect(new Set(next.map(x => x.meal.id)).size).toBe(2);
});

it("keeps never-served discovery and deprioritizes recent meals", () => {
  expect(getRecencyScore(undefined, now)).toBe(14);
  expect(getRecencyScore(now - DAY_MS, now)).toBeLessThan(getRecencyScore(now - 56 * DAY_MS, now));
  expect(plan([meal("recent"), meal("older")], { servedEntries: [served("recent", 1), served("older", 56)] })[0].meal.id).toBe("older");
});

it("does not overwrite existing days, duplicate meals or relax filters to fill a day", () => {
  const pins = createEmptyDayPinsMap(); pins.wed.effort = "hard";
  const plannedWeek = { ...createEmptyCurrentPlannedWeek(), tue: "existing" };
  const result = plan([meal("existing"), meal("easy", { difficulty: 1 })], { days: ["tue", "wed"], plannedWeek, dayPinsMap: pins });
  expect(result).toEqual([]);
  expect(plannedWeek.tue).toBe("existing");
});

it("bounds whole-week penalties and respects explicit effort and expense settings", () => {
  const row = { meal: meal("hard", { cuisine: "mexican", difficulty: 5, expense: 6 }), effortSpecified: false, expenseSpecified: false };
  expect(getWholeWeekPenalty(Array(7).fill(row))).toBe(8);
  expect(getWholeWeekPenalty(Array(3).fill({ ...row, effortSpecified: true, expenseSpecified: true }))).toBe(0);
});

it("whole-week comparison prefers a less repetitive exact-tie candidate", () => {
  const meals = [0, 1, 2].map(i => meal(`existing${i}`, { cuisine: "mexican" }));
  meals.push(meal("mex", { cuisine: "mexican" }), meal("italian", { cuisine: "italian" }));
  const draws = [0.9, 0.1, 0.1, 0.9, 0.9, 0.1]; let index = 0;
  const result = plan(meals, { plannedWeek: { ...createEmptyCurrentPlannedWeek(), mon: "existing0", wed: "existing1", thu: "existing2" }, random: () => draws[index++] });
  expect(result[0].meal.id).toBe("italian");
});

it("preserves manually chosen sides through retries, including deliberately empty selections", () => {
  let state = getAutoPlanSideState(["Rice"], "Salad");
  state = getAutoPlanSideState(state.assignedSides, "Beans", state);
  expect(state.assignedSides).toEqual(["Rice"]);
  state = getAutoPlanSideState([], "Beans", state);
  state = getAutoPlanSideState([], "Peas", state);
  expect(state.assignedSides).toEqual([]);
  const generated = getAutoPlanSideState([], "Salad");
  expect(getAutoPlanSideState(generated.assignedSides, "Beans", generated).assignedSides).toEqual(["Beans"]);
});

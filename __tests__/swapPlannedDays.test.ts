import { swapPlannedDays } from "../utils/swapPlannedDays";
import { createEmptyCurrentPlannedWeek, createEmptyCurrentWeekSides } from "../types/weekPlan";

it("moves a dinner and its sides into an empty day without mutating the original", () => {
  const plan = { ...createEmptyCurrentPlannedWeek(), mon: "tacos", wed: "pasta", weekedPlanned: true };
  const sides = { ...createEmptyCurrentWeekSides(), mon: ["Rice"] };
  const next = swapPlannedDays(plan, sides, "mon", "tue");
  expect(next.plan).toMatchObject({ mon: null, tue: "tacos", wed: "pasta", weekedPlanned: false });
  expect(next.sides.mon).toEqual([]);
  expect(next.sides.tue).toEqual(["Rice"]);
  expect(plan.mon).toBe("tacos");
  expect(sides.mon).toEqual(["Rice"]);
});

it("swaps occupied days including custom eat-out titles and sides", () => {
  const plan = { ...createEmptyCurrentPlannedWeek(), mon: "tacos", tue: "eat-out", specialMealTitles: { tue: "Birthday dinner", fri: "Pizza place" } };
  const sides = { ...createEmptyCurrentWeekSides(), mon: ["Rice"], tue: ["Salad"] };
  const next = swapPlannedDays(plan, sides, "mon", "tue");
  expect(next.plan).toMatchObject({ mon: "eat-out", tue: "tacos", specialMealTitles: { mon: "Birthday dinner", fri: "Pizza place" } });
  expect(next.plan.specialMealTitles?.tue).toBeUndefined();
  expect(next.sides.mon).toEqual(["Salad"]);
  expect(next.sides.tue).toEqual(["Rice"]);
});

it("ignores empty sources and same-day swaps", () => {
  const plan = { ...createEmptyCurrentPlannedWeek(), mon: "tacos" };
  const sides = createEmptyCurrentWeekSides();
  expect(swapPlannedDays(plan, sides, "mon", "mon").plan).toBe(plan);
  expect(swapPlannedDays(plan, sides, "tue", "mon").plan).toBe(plan);
});

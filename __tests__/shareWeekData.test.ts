import { getShareWeekOrder, selectShareWeek, shareDayDetails } from "../components/share-week/shareWeekData";
import { WeekPlanDay } from "../hooks/useCurrentWeekPlan";
const day = (title?: string, mealId = "meal", sides: string[] = []): WeekPlanDay => ({ key: "mon", label: "Mon", displayName: "Monday", plannedDate: new Date(2026, 8, 14), plannedDateISO: "2026-09-14", status: "today", mealId: title ? mealId : null, meal: title ? { id: mealId, title } as WeekPlanDay["meal"] : undefined, sides });
it("selects next week first for legacy plans, current as fallback, and hides when empty", () => {
  const current = [day("Tacos")]; const next = [day("Pasta")];
  expect(selectShareWeek(current, next)).toBe(next);
  expect(selectShareWeek(current, [day()])).toBe(current);
  expect(selectShareWeek([day()], next)).toBe(next);
  expect(selectShareWeek([day()], [day()])).toEqual([]);
});
it("uses only saved sides and preserves custom eat out titles as notes", () => {
  expect(shareDayDetails(day("Tacos", "meal", ["Rice", "Corn"]))).toMatchObject({ title: "Tacos", subtitle: "Rice · Corn" });
  expect(shareDayDetails(day("Olive Garden", "__eat_out__"))).toMatchObject({ title: "Eat Out", subtitle: "Olive Garden" });
  expect(shareDayDetails(day("Eat Out Night", "__eat_out__")).subtitle).toBe("");
  expect(shareDayDetails(day("Flex Night", "__flex_night__"))).toMatchObject({ title: "Flex Night", symbol: "sync" });
  expect(shareDayDetails(day())).toMatchObject({ title: "Unplanned", subtitle: "" });
});

it("excludes completed current weeks even when no next week is available", () => {
  const current = [day("Tacos")]; const next = [day("Pasta")];
  expect(getShareWeekOrder(current, next, { currentCompleted: true })).toEqual(["next"]);
  expect(selectShareWeek(current, [], { currentCompleted: true })).toEqual([]);
});
it("orders by the most recently saved plan, with next first when dates are unavailable", () => {
  const current = [day("Tacos")]; const next = [day("Pasta")];
  expect(getShareWeekOrder(current, next, { currentPlannedAt: "2026-09-25T15:00:00Z", nextPlannedAt: "2026-09-25T16:00:00Z" })).toEqual(["next", "current"]);
  expect(getShareWeekOrder(current, next, { currentPlannedAt: "2026-09-25T17:00:00Z", nextPlannedAt: "2026-09-25T16:00:00Z" })).toEqual(["current", "next"]);
  expect(getShareWeekOrder(current, next, { currentPlannedAt: "invalid" })).toEqual(["next", "current"]);
});

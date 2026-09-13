import { selectShareWeek, shareDayDetails } from "../components/share-week/shareWeekData";
import { WeekPlanDay } from "../hooks/useCurrentWeekPlan";
const day = (title?: string, mealId = "meal", sides: string[] = []): WeekPlanDay => ({ key: "mon", label: "Mon", displayName: "Monday", plannedDate: new Date(2026, 8, 14), plannedDateISO: "2026-09-14", status: "today", mealId: title ? mealId : null, meal: title ? { id: mealId, title } as WeekPlanDay["meal"] : undefined, sides });
it("selects the current planned week, next as fallback, and hides when empty", () => {
  const current = [day("Tacos")]; const next = [day("Pasta")];
  expect(selectShareWeek(current, next)).toBe(current);
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

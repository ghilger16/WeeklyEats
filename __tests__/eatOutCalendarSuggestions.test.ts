import { getEatOutCalendarSuggestions } from "../components/plan-week/inline/eatOutCalendarSuggestions";
import { PlanningCalendarEvent } from "../utils/calendar-service";

const event = (
  title: string,
  startDate: string,
  isAllDay = false,
): PlanningCalendarEvent => ({
  id: `${title}-${startDate}`,
  title,
  startDate,
  endDate: startDate,
  isAllDay,
});

describe("getEatOutCalendarSuggestions", () => {
  it("removes generic and duplicate titles and limits results to three", () => {
    const result = getEatOutCalendarSuggestions([
      event("Busy", "2026-07-18T17:00:00.000Z"),
      event("Dinner with Sarah", "2026-07-18T18:00:00.000Z"),
      event("dinner with sarah", "2026-07-18T19:00:00.000Z"),
      event("Suns vs Lakers", "2026-07-18T20:00:00.000Z"),
      event("Birthday Party", "2026-07-18T21:00:00.000Z"),
      event("Concert", "2026-07-18T22:00:00.000Z"),
    ]);

    expect(result.map((item) => item.title)).toEqual([
      "Dinner with Sarah",
      "Suns vs Lakers",
      "Birthday Party",
    ]);
  });

  it("prefers timed evening events over all-day events", () => {
    const result = getEatOutCalendarSuggestions([
      event("Birthday", "2026-07-18T00:00:00.000Z", true),
      event("Dinner", "2026-07-18T18:00:00.000Z"),
    ]);

    expect(result.map((item) => item.title)).toEqual(["Dinner", "Birthday"]);
  });
});

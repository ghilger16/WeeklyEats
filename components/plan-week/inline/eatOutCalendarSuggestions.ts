import { PlanningCalendarEvent } from "../../../utils/calendar-service";

const EXCLUDED_TITLES = new Set([
  "busy",
  "focus time",
  "reminder",
  "blocked",
  "available",
]);

export const getEatOutCalendarSuggestions = (
  events: PlanningCalendarEvent[],
): PlanningCalendarEvent[] => {
  const uniqueTitles = new Set<string>();
  return [...events]
    .sort((left, right) => {
      const leftIsTimed = left.isAllDay ? 0 : 1;
      const rightIsTimed = right.isAllDay ? 0 : 1;
      if (leftIsTimed !== rightIsTimed) return rightIsTimed - leftIsTimed;
      return left.startDate.localeCompare(right.startDate);
    })
    .filter((event) => {
      const normalizedTitle = event.title.trim().toLowerCase();
      if (!normalizedTitle || EXCLUDED_TITLES.has(normalizedTitle)) return false;
      if (uniqueTitles.has(normalizedTitle)) return false;
      uniqueTitles.add(normalizedTitle);
      return true;
    })
    .slice(0, 3);
};

import type * as ExpoCalendar from "expo-calendar";
import { Platform } from "react-native";

type CalendarModule = typeof ExpoCalendar;

export type PlanningCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
};

export type PlanningCalendarEventsByDay = Record<
  string,
  PlanningCalendarEvent[]
>;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const asDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const loadCalendarModule = async (): Promise<CalendarModule | null> => {
  try {
    return await import("expo-calendar");
  } catch {
    return null;
  }
};

const isVisibleEventCalendar = (
  calendarModule: CalendarModule,
  calendar: ExpoCalendar.Calendar,
) => {
  if (
    calendar.entityType &&
    calendar.entityType !== calendarModule.EntityTypes.EVENT
  ) {
    return false;
  }
  if (Platform.OS === "android") {
    return calendar.isVisible !== false && calendar.isSynced !== false;
  }
  return true;
};

const isPlanningRelevantEvent = (event: PlanningCalendarEvent) => {
  if (event.isAllDay) {
    return true;
  }
  return asDate(event.startDate).getHours() >= 16;
};

const normalizeEvent = (
  calendarModule: CalendarModule,
  event: ExpoCalendar.Event,
): PlanningCalendarEvent | null => {
  if (event.status === calendarModule.EventStatus.CANCELED) {
    return null;
  }

  return {
    id: event.id,
    title: event.title?.trim() || "Calendar event",
    startDate: asDate(event.startDate).toISOString(),
    endDate: asDate(event.endDate).toISOString(),
    isAllDay: Boolean(event.allDay),
  };
};

export const getWeekEvents = async (
  startDate: Date,
  endDate: Date,
): Promise<PlanningCalendarEvent[]> => {
  const Calendar = await loadCalendarModule();
  if (!Calendar) {
    return [];
  }

  const isAvailable = await Calendar.isAvailableAsync();
  if (!isAvailable) {
    return [];
  }

  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) {
    return [];
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars
    .filter((calendar) => isVisibleEventCalendar(Calendar, calendar))
    .map((calendar) => calendar.id);

  if (!calendarIds.length) {
    return [];
  }

  const events = await Calendar.getEventsAsync(
    calendarIds,
    startOfDay(startDate),
    endOfDay(endDate),
  );
  const uniqueEvents = new Map<string, PlanningCalendarEvent>();

  events.forEach((event) => {
    const normalized = normalizeEvent(Calendar, event);
    if (!normalized || !isPlanningRelevantEvent(normalized)) {
      return;
    }
    uniqueEvents.set(`${normalized.id}:${normalized.startDate}`, normalized);
  });

  return [...uniqueEvents.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
};

export const groupEventsByDay = (
  events: PlanningCalendarEvent[],
): PlanningCalendarEventsByDay =>
  events.reduce<PlanningCalendarEventsByDay>((acc, event) => {
    const start = startOfDay(asDate(event.startDate));
    const eventEnd = event.isAllDay
      ? startOfDay(addDays(asDate(event.endDate), -1))
      : start;
    const end = eventEnd.getTime() < start.getTime() ? start : eventEnd;

    for (
      let cursor = start;
      cursor.getTime() <= end.getTime();
      cursor = addDays(cursor, 1)
    ) {
      const dateKey = toDateKey(cursor);
      acc[dateKey] = [...(acc[dateKey] ?? []), event];
    }

    return acc;
  }, {});

export const formatEventTime = (event: PlanningCalendarEvent) => {
  if (event.isAllDay) {
    return "All Day";
  }

  return asDate(event.startDate).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

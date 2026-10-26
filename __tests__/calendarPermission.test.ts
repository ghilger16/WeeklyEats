import * as Calendar from "expo-calendar";
import { getWeekEvents } from "../utils/calendar-service";

jest.mock("expo-calendar", () => ({
  isAvailableAsync: jest.fn(),
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getEventsAsync: jest.fn(),
  EntityTypes: { EVENT: "event" },
  EventStatus: { CANCELED: "canceled" },
}));

const start = new Date(2026, 8, 28);
const end = new Date(2026, 9, 4);
beforeEach(() => {
  jest.resetAllMocks();
  (Calendar.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([{ id: "personal", entityType: "event" }]);
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
});

it.each(["undetermined", "denied"])("does not prompt or fetch events when existing permission is %s", async (status) => {
  (Calendar.getCalendarPermissionsAsync as jest.Mock).mockResolvedValue({ status, granted: false });
  expect(await getWeekEvents(start, end)).toEqual([]);
  expect(Calendar.requestCalendarPermissionsAsync).not.toHaveBeenCalled();
  expect(Calendar.getCalendarsAsync).not.toHaveBeenCalled();
  expect(Calendar.getEventsAsync).not.toHaveBeenCalled();
});

it("fetches events with existing permission without prompting", async () => {
  (Calendar.getCalendarPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  await getWeekEvents(start, end);
  expect(Calendar.requestCalendarPermissionsAsync).not.toHaveBeenCalled();
  expect(Calendar.getEventsAsync).toHaveBeenCalledWith(["personal"], expect.any(Date), expect.any(Date));
});

it("allows explicit calendar opt-in after a passive check", async () => {
  (Calendar.getCalendarPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  (Calendar.requestCalendarPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  await getWeekEvents(start, end);
  await getWeekEvents(start, end, { requestPermission: true });
  expect(Calendar.requestCalendarPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Calendar.getEventsAsync).toHaveBeenCalledTimes(1);
});

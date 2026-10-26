jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { createWidgetSync } from "../services/widget/syncWidgetState";
import { WIDGET_DATA_CHANGED } from "../services/widget/widgetEvents";
import { buildWidgetSnapshot, WidgetSource } from "../utils/todayWidgetPlan";
import { readWidgetSource } from "../stores/widgetSourceStorage";
import { addServedMeal, removeServedMeal } from "../stores/servedMealsStorage";
import { setMeals } from "../stores/mealsStorage";
import { getCurrentWeekPlan, getCurrentWeekSides, setCurrentWeekPlan, setCurrentWeekSides, setWeekPlanDataBatch, clearWeekPlanData } from "../stores/weekPlanStorage";
import { createEmptyCurrentPlannedWeek, createEmptyCurrentWeekSides } from "../types/weekPlan";
import { localDateKey, resolvePlanWeekDate } from "../utils/widgetCalendar";
import { Meal } from "../types/meals";

const monday = new Date(2026, 8, 28, 12);
const week = "2026-09-28";
const fixture = (): WidgetSource => ({ startDay: "mon", servedEntries: [],
  plans: { [week]: { ...createEmptyCurrentPlannedWeek({ weekStartISO: week }), calendarWeekStartDate: week, mon: "A", tue: "B" } },
  sides: { [week]: { ...createEmptyCurrentWeekSides(), mon: ["Rice"] } },
  meals: [{ id: "A", title: "Meal A", emoji: "🍝", prepNotes: "Prep A" }, { id: "B", title: "Meal B" }] as Meal[] });

beforeEach(async () => { await AsyncStorage.clear(); });

it("rebuilds for the actual local day on resume, preserving tomorrow and metadata", () => {
  const source = fixture();
  const first = buildWidgetSnapshot(source, monday);
  expect(first.today).toMatchObject({ mealId: "A", mealDate: week, weekStartDate: week, sides: ["Rice"], prepNote: "Prep A" });
  expect(first.tomorrow?.mealId).toBe("B");
  expect(first.snapshotDate).toBe(week);
  const next = buildWidgetSnapshot(source, new Date(2026, 8, 29, 7));
  expect(next.today.mealId).toBe("B");
  expect(next.todayOutcome).toBeUndefined();
  expect(buildWidgetSnapshot(source, new Date(2026, 8, 30)).today.isPlanned).toBe(false);
});

it("uses stable local week metadata and translates old UTC-truncated week IDs", () => {
  expect(resolvePlanWeekDate("2026-09-27", "mon")).toBe(week);
  expect(resolvePlanWeekDate("2026-09-27", "fri", week)).toBe(week);
  expect(resolvePlanWeekDate("2026-10-05", "mon", week)).toBe("2026-10-05");
  const source = fixture();
  source.startDay = "fri";
  expect(buildWidgetSnapshot(source, monday).today.mealId).toBe("A");
});

it("coalesces requests and ignores widget-irrelevant meal fields", async () => {
  const source = fixture();
  let now = monday;
  const save = jest.fn().mockResolvedValue(true);
  const sync = createWidgetSync({ read: async () => source, save, now: () => now, settle: async () => {} });
  await Promise.all([sync(), sync(), sync()]);
  expect(save).toHaveBeenCalledTimes(1);
  source.meals[0].rating = 5;
  now = new Date(2026, 8, 28, 18);
  await sync();
  expect(save).toHaveBeenCalledTimes(1);
  source.meals[1].title = "New tomorrow";
  await sync();
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0].today.mealId).toBe("A");
  expect(save.mock.calls[1][0].tomorrow.title).toBe("New tomorrow");
});

it("discards a snapshot read superseded by a newer persisted mutation", async () => {
  let finishRead!: (source: WidgetSource) => void;
  const pending = new Promise<WidgetSource>((resolve) => { finishRead = resolve; });
  const fresh = fixture(); fresh.plans[week].mon = "B";
  const read = jest.fn().mockReturnValueOnce(pending).mockResolvedValue(fresh);
  const save = jest.fn().mockResolvedValue(true);
  const sync = createWidgetSync({ read, save, now: () => monday, settle: async () => {} });
  const first = sync();
  await Promise.resolve();
  const second = sync();
  finishRead(fixture());
  await Promise.all([first, second]);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].today.mealId).toBe("B");
});

it("retries a failed bridge write instead of caching unsaved content", async () => {
  const save = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const sync = createWidgetSync({ read: async () => fixture(), save, now: () => monday, settle: async () => {} });
  await expect(sync()).rejects.toThrow("Widget shared-data write failed");
  await sync();
  expect(save).toHaveBeenCalledTimes(2);
});

it("syncs persisted planning, replacement, sides, notes, outcomes, undo and deletion without the dashboard", async () => {
  const source = fixture();
  const save = jest.fn().mockResolvedValue(true);
  const sync = createWidgetSync({ read: readWidgetSource, save, now: () => monday, settle: async () => {} });
  const requests: Promise<void>[] = [];
  const listener = DeviceEventEmitter.addListener(WIDGET_DATA_CHANGED, () => { requests.push(sync()); });
  const flush = async () => { await Promise.all(requests); requests.length = 0; };
  const latest = () => save.mock.calls.at(-1)![0];
  try {
    await setMeals(source.meals);
    await setWeekPlanDataBatch([{ weekStartISO: week, plan: source.plans[week], sides: source.sides[week] }]);
    await flush();
    expect(latest().today.mealId).toBe("A");
    await setCurrentWeekPlan(week, { ...source.plans[week], mon: "B" });
    await flush();
    expect(latest().today.mealId).toBe("B");
    await setCurrentWeekSides(week, { ...source.sides[week], mon: ["Salad"] });
    source.meals[1].prepNotes = "Chop vegetables";
    await setMeals(source.meals);
    await flush();
    expect(latest().today).toMatchObject({ sides: ["Salad"], prepNote: "Chop vegetables" });
    for (const outcome of ["served", "cookedAlt", "ateOut", "skipped"] as const) {
      await addServedMeal({ id: "today", dayKey: "mon", mealId: "B", servedAtISO: monday.toISOString(), outcome });
      await flush();
      expect(latest().todayOutcome).toBe(outcome);
      expect(latest().outcomesByDate[week].servedState).toBe(outcome);
    }
    await removeServedMeal("today"); await flush();
    expect(latest().todayOutcome).toBeUndefined();
    for (const id of ["__eat_out__", "__flex_night__"]) {
      await setCurrentWeekPlan(week, { ...source.plans[week], mon: id }); await flush();
      expect(latest().today.mealId).toBe(id);
    }
    await clearWeekPlanData(); await flush();
    expect(latest().today.isPlanned).toBe(false);
    expect(latest().plannedMeals).toEqual([]);
  } finally { listener.remove(); }
});

it("reads missing weeks and widget source without mutating saved plans", async () => {
  await setWeekPlanDataBatch([{ weekStartISO: week, plan: fixture().plans[week], sides: fixture().sides[week] }]);
  const stored = await AsyncStorage.getItem("@weeklyeats/weekPlanByWeek");
  await Promise.all([getCurrentWeekPlan("2026-10-05"), getCurrentWeekSides("2026-10-05"), readWidgetSource()]);
  expect(await AsyncStorage.getItem("@weeklyeats/weekPlanByWeek")).toBe(stored);
  const source = await readWidgetSource();
  expect(localDateKey(monday)).toBe(week);
  expect(buildWidgetSnapshot(source, monday).today.isPlanned).toBe(false); // no matching meal library yet
});

it("preserves concurrent current- and next-week writes", async () => {
  const source = fixture();
  await Promise.all([
    setCurrentWeekPlan(week, source.plans[week]),
    setCurrentWeekPlan("2026-10-05", { ...source.plans[week], weekStartISO: "2026-10-05", calendarWeekStartDate: "2026-10-05", mon: "B" }),
  ]);
  const stored = await readWidgetSource();
  expect(stored.plans[week].mon).toBe("A");
  expect(stored.plans["2026-10-05"].mon).toBe("B");
});

it("leaves a good widget snapshot alone on storage errors and recovers on the next request", async () => {
  const read = jest.fn().mockResolvedValueOnce(fixture()).mockRejectedValueOnce(new Error("Storage unavailable")).mockResolvedValue(fixture());
  const save = jest.fn().mockResolvedValue(true);
  const sync = createWidgetSync({ read, save, now: () => monday, settle: async () => {} });
  await sync();
  await expect(sync()).rejects.toThrow("Storage unavailable");
  await sync();
  expect(save).toHaveBeenCalledTimes(1);
});

it("finishes a newer sync after an older native write completes", async () => {
  let finishSave!: (saved: boolean) => void;
  const saving = new Promise<boolean>((resolve) => { finishSave = resolve; });
  const source = fixture();
  const save = jest.fn().mockReturnValueOnce(saving).mockResolvedValue(true);
  const sync = createWidgetSync({ read: async () => source, save, now: () => monday, settle: async () => {} });
  const first = sync();
  await Promise.resolve(); await Promise.resolve();
  expect(save).toHaveBeenCalledTimes(1);
  source.plans[week].mon = "B";
  const newer = sync();
  finishSave(true);
  await Promise.all([first, newer]);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls.at(-1)![0].today.mealId).toBe("B");
});

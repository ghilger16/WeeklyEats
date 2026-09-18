jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addWeekPlanHistory,
  getCurrentWeekPlan,
  getCurrentWeekSides,
  getWeekPlanHistory,
  getWeekPlanDraft,
  getWeekPlanStreak,
  clearWeekPlanDraft,
  setWeekPlanDraft,
  setWeekPlanDataBatch,
  updateWeekPlanStreak,
} from "../weekPlanStorage";
import {
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
  PLANNED_WEEK_ORDER,
} from "../../types/weekPlan";

describe("week planning drafts", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("stores unfinished selections separately from the official plan", async () => {
    const draftPlan = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-08-16",
    });
    draftPlan.mon = "draft-meal";
    const draftSides = createEmptyCurrentWeekSides();
    draftSides.mon = ["Salad"];

    await setWeekPlanDraft("2026-08-16", draftPlan, draftSides);

    await expect(getWeekPlanDraft("2026-08-16")).resolves.toMatchObject({
      plan: { mon: "draft-meal", weekedPlanned: false },
      sides: { mon: ["Salad"] },
    });
    await expect(getCurrentWeekPlan("2026-08-16")).resolves.toMatchObject({
      mon: null,
    });

    await clearWeekPlanDraft("2026-08-16");
    await expect(getWeekPlanDraft("2026-08-16")).resolves.toBeNull();
  });
});

describe("setWeekPlanDataBatch", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("persists current and next week without either update being overwritten", async () => {
    const currentPlan = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-07-12",
      weekedPlanned: true,
    });
    currentPlan.tue = "replacement-meal";
    const currentSides = createEmptyCurrentWeekSides();
    currentSides.tue = ["Salad"];

    const nextPlan = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-07-19",
      weekedPlanned: true,
    });
    nextPlan.carryOverIdeas = [
      {
        mealId: "displaced-meal",
        title: "Shakshuka Delight",
        emoji: "🍽️",
        suggestedAt: "2026-07-14T12:00:00.000Z",
      },
    ];
    const nextSides = createEmptyCurrentWeekSides();
    nextSides.mon = ["Rice"];

    await setWeekPlanDataBatch([
      {
        weekStartISO: "2026-07-12",
        plan: currentPlan,
        sides: currentSides,
      },
      {
        weekStartISO: "2026-07-19",
        plan: nextPlan,
        sides: nextSides,
      },
    ]);

    await expect(getCurrentWeekPlan("2026-07-12")).resolves.toMatchObject({
      tue: "replacement-meal",
    });
    await expect(getCurrentWeekPlan("2026-07-19")).resolves.toMatchObject({
      mon: null,
      carryOverIdeas: [
        expect.objectContaining({ mealId: "displaced-meal" }),
      ],
    });
    await expect(getCurrentWeekSides("2026-07-12")).resolves.toMatchObject({
      tue: ["Salad"],
    });
    await expect(getCurrentWeekSides("2026-07-19")).resolves.toMatchObject({
      mon: ["Rice"],
    });
  });
});

describe("week plan history snapshots", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("preserves the planned meal display data and celebration summary", async () => {
    const plan = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-08-16",
      weekedPlanned: true,
    });
    PLANNED_WEEK_ORDER.forEach((day) => {
      plan[day] = "tacos";
    });

    await addWeekPlanHistory(plan, {
      meals: [
        {
          id: "tacos",
          title: "Chicken Tacos",
          emoji: "🌮",
          rating: 5,
          familyRatings: {},
          servedCount: 0,
          showServedCount: false,
          plannedCostTier: 1,
          locked: false,
          isFavorite: false,
          difficulty: 1,
          expense: 1,
        },
      ],
      servedMealIds: new Set(),
      isComplete: true,
    });

    const [entry] = await getWeekPlanHistory();
    expect(entry.mealSnapshots?.tacos).toMatchObject({
      title: "Chicken Tacos",
      emoji: "🌮",
    });
    expect(entry.summary).toMatchObject({ dinnerCount: 7 });
    expect(entry.summary?.stats.map((stat) => stat.id)).toEqual(
      ["dinners", "easy", "budget"],
    );
  });

  it("does not record a completed partial week", async () => {
    const plan = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-08-16",
      weekedPlanned: true,
    });
    plan.sun = "tacos";

    await addWeekPlanHistory(plan, { isComplete: true });

    await expect(getWeekPlanHistory()).resolves.toEqual([]);
  });
});

describe("week planning streak", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("counts each consecutive completed week beginning with the first", async () => {
    await expect(
      updateWeekPlanStreak(new Date("2026-08-16T12:00:00.000Z")),
    ).resolves.toMatchObject({ count: 1 });
    await expect(
      updateWeekPlanStreak(new Date("2026-08-23T12:00:00.000Z")),
    ).resolves.toMatchObject({ count: 2 });
    await expect(
      updateWeekPlanStreak(new Date("2026-08-30T12:00:00.000Z")),
    ).resolves.toMatchObject({ count: 3 });
  });

  it("does not increment twice for the same week and resets after a gap", async () => {
    const week = new Date("2026-08-16T12:00:00.000Z");
    await updateWeekPlanStreak(week);
    await expect(updateWeekPlanStreak(week)).resolves.toMatchObject({ count: 1 });
    await expect(
      updateWeekPlanStreak(new Date("2026-08-30T12:00:00.000Z")),
    ).resolves.toMatchObject({ count: 1 });
    await expect(getWeekPlanStreak()).resolves.toMatchObject({ count: 1 });
  });

  it("adds a week to history as soon as that week is completed", async () => {
    const firstWeek = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-08-16",
      weekedPlanned: true,
    });
    PLANNED_WEEK_ORDER.forEach((day) => {
      firstWeek[day] = "tacos";
    });
    await addWeekPlanHistory(firstWeek, { isComplete: true });
    await updateWeekPlanStreak(new Date("2026-08-16T12:00:00.000Z"));

    await expect(getWeekPlanHistory()).resolves.toEqual([
      expect.objectContaining({ weekStartISO: "2026-08-16" }),
    ]);

    const secondWeek = createEmptyCurrentPlannedWeek({
      weekStartISO: "2026-08-23",
      weekedPlanned: true,
    });
    PLANNED_WEEK_ORDER.forEach((day) => {
      secondWeek[day] = "pasta";
    });
    await addWeekPlanHistory(secondWeek, { isComplete: true });
    await expect(
      updateWeekPlanStreak(new Date("2026-08-23T12:00:00.000Z")),
    ).resolves.toMatchObject({ count: 2 });

    await expect(getWeekPlanHistory()).resolves.toEqual([
      expect.objectContaining({ weekStartISO: "2026-08-23" }),
      expect.objectContaining({ weekStartISO: "2026-08-16" }),
    ]);
  });
});

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCurrentWeekPlan,
  getCurrentWeekSides,
  setWeekPlanDataBatch,
} from "../weekPlanStorage";
import {
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
} from "../../types/weekPlan";

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

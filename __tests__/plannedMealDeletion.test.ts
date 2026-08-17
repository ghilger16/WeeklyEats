import { getActivePlannedMealOccurrences } from "../utils/plannedMealDeletion";
import { getCurrentWeekPlan } from "../stores/weekPlanStorage";
import {
  createEmptyCurrentPlannedWeek,
  PLANNED_WEEK_ORDER,
} from "../types/weekPlan";

jest.mock("../stores/weekPlanStorage", () => ({
  getCurrentWeekPlan: jest.fn(),
}));

const getPlanMock = getCurrentWeekPlan as jest.MockedFunction<
  typeof getCurrentWeekPlan
>;

describe("planned meal deletion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("finds references only in the active current and next week plans", async () => {
    getPlanMock
      .mockResolvedValueOnce({
        ...createEmptyCurrentPlannedWeek(),
        tue: "target",
      })
      .mockResolvedValueOnce({
        ...createEmptyCurrentPlannedWeek(),
        sat: "target",
      });

    await expect(
      getActivePlannedMealOccurrences({
        mealId: "target",
        startDay: "mon",
        orderedDays: PLANNED_WEEK_ORDER,
        referenceDate: new Date(2026, 7, 12, 12),
      }),
    ).resolves.toMatchObject([
      { scope: "current", dayKey: "tue", dayLabel: "Tuesday" },
      { scope: "next", dayKey: "sat", dayLabel: "Saturday" },
    ]);
  });
});

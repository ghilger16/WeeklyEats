import {
  getActivePlannedMealOccurrences,
  resolvePlannedMealOccurrence,
} from "../utils/plannedMealDeletion";
import {
  getCurrentWeekPlan,
  getCurrentWeekSides,
  setCurrentWeekPlan,
  setCurrentWeekSides,
} from "../stores/weekPlanStorage";
import {
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
  PLANNED_WEEK_ORDER,
} from "../types/weekPlan";

jest.mock("../stores/weekPlanStorage", () => ({
  getCurrentWeekPlan: jest.fn(),
  getCurrentWeekSides: jest.fn(),
  setCurrentWeekPlan: jest.fn(),
  setCurrentWeekSides: jest.fn(),
}));

const getPlanMock = getCurrentWeekPlan as jest.MockedFunction<
  typeof getCurrentWeekPlan
>;
const getSidesMock = getCurrentWeekSides as jest.MockedFunction<
  typeof getCurrentWeekSides
>;
const setPlanMock = setCurrentWeekPlan as jest.MockedFunction<
  typeof setCurrentWeekPlan
>;
const setSidesMock = setCurrentWeekSides as jest.MockedFunction<
  typeof setCurrentWeekSides
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

  it("removes a planned meal and clears that day's sides", async () => {
    getPlanMock.mockResolvedValue({
      ...createEmptyCurrentPlannedWeek(),
      tue: "target",
    });
    getSidesMock.mockResolvedValue({
      ...createEmptyCurrentWeekSides(),
      tue: ["Rice"],
    });

    await resolvePlannedMealOccurrence({
      occurrence: {
        scope: "current",
        weekStartISO: "2026-08-10",
        dayKey: "tue",
        dayLabel: "Tuesday",
      },
      replacementMealId: null,
    });

    expect(setPlanMock).toHaveBeenCalledWith(
      "2026-08-10",
      expect.objectContaining({ tue: null }),
    );
    expect(setSidesMock).toHaveBeenCalledWith(
      "2026-08-10",
      expect.objectContaining({ tue: [] }),
    );
  });
});

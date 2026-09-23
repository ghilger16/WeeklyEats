import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Modal } from "react-native";
import MealRowDetailsSheet from "../components/week-dashboard/MealRowDetailsSheet";
import { WeekPlanDay } from "../hooks/useCurrentWeekPlan";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("../providers/theme/ThemeController", () => ({
  useThemeController: () => ({ theme: require("../styles/theme").lightTheme }),
}));
jest.mock("../hooks/useMeals", () => ({ useMeals: () => ({ updateMeal: jest.fn() }) }));
jest.mock("../hooks/useFamilyMembers", () => ({ useFamilyMembers: () => ({ members: [] }) }));
jest.mock("../hooks/useRatingDisplayMode", () => ({ useRatingDisplayMode: () => ({ mode: "off" }) }));
jest.mock("../components/meals/FreezerAmountModal", () => () => null);
jest.mock("../components/meals/FamilyRatingRow", () => () => null);
jest.mock("../components/meals/RatingStars", () => () => null);
jest.mock("../components/plan-week/inline/InlineSideEditor", () => () => null);
jest.mock("../utils/ingredientClassification", () => ({}));

const day = {
  key: "wed", label: "Wed", displayName: "Wednesday", status: "upcoming",
  plannedDate: new Date(2026, 8, 23), mealId: "tacos",
  meal: { id: "tacos", title: "Tacos", emoji: "🌮", ingredients: [] }, sides: [],
} as unknown as WeekPlanDay;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

it("switches an embedded details sheet to change meal without dismissing its host", async () => {
  const onClose = jest.fn();
  const onChangeMeal = jest.fn();
  const screen = render(
    <MealRowDetailsSheet embedded day={day} onClose={onClose}
      onChangeMeal={onChangeMeal} onSaveSides={jest.fn()}
      onMarkServed={jest.fn()} onEatOut={jest.fn()} onViewMeal={jest.fn()}
      onUndoServed={jest.fn()} />,
  );
  await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
  expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  fireEvent.press(screen.getByLabelText("Change Meal"));
  expect(onChangeMeal).toHaveBeenCalledWith(day);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Close meal details"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

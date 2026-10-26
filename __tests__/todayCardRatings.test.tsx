import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, ScrollView } from "react-native";
import TodayCard from "../components/week-dashboard/TodayCard";
import { createEmptyMealDraft } from "../types/meals";
import { ServedMealEntry } from "../stores/servedMealsStorage";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn().mockResolvedValue(undefined), NotificationFeedbackType: { Success: "success" } }));
jest.mock("../providers/theme/ThemeController", () => ({ useThemeController: () => ({ theme: require("../styles/theme").lightTheme }) }));
jest.mock("../hooks/useFamilyMembers", () => ({ useFamilyMembers: () => ({ members: [] }) }));
jest.mock("../components/meals/FamilyRatingRow", () => () => null);
jest.mock("../components/meals/FreezerAmountModal", () => () => null);
jest.mock("../components/week-dashboard/BurstSparkles", () => () => null);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

it.each([0, 4])("opens ratings after serving only when the meal has no rating (rating %s)", async (rating) => {
  const meal = { ...createEmptyMealDraft(), id: "pasta", title: "Pasta", rating };
  let finishSave!: () => void;
  const saved = new Promise<void>((resolve) => { finishSave = resolve; });
  const props = { meal, dateLabel: "Monday", ratingMode: "summary" as const, onMarkServed: jest.fn(() => saved) };
  const screen = render(<TodayCard {...props} />);
  await act(async () => { fireEvent.press(screen.getByLabelText("Mark Pasta as served")); });
  screen.rerender(<TodayCard {...props} servedEntry={{ outcome: "served" } as ServedMealEntry} />);
  await act(async () => { finishSave(); await saved; });
  act(() => { jest.advanceTimersByTime(1200); });
  fireEvent(screen.getByLabelText("Show ratings card"), "layout", { nativeEvent: { layout: { width: 320 } } });
  const carousel = screen.UNSAFE_getAllByType(ScrollView).find((view) => view.props.pagingEnabled)!;
  fireEvent(carousel, "contentSizeChange", 1280, 191);
  expect(screen.getByLabelText("Show ratings card").props.accessibilityState.selected).toBe(rating === 0);
  // A later content/layout update must not pull the user back after swiping away.
  fireEvent.press(screen.getByLabelText("Show notes card"));
  fireEvent(carousel, "contentSizeChange", 1280, 191);
  expect(screen.getByLabelText("Show notes card").props.accessibilityState.selected).toBe(true);
});

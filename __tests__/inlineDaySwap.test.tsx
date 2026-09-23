import { fireEvent, render } from "@testing-library/react-native";
import InlineDaySearch from "../components/plan-week/inline/InlineDaySearch";
import { createEmptyMealDraft } from "../types/meals";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("../providers/theme/ThemeController", () => ({ useThemeController: () => ({ theme: require("../styles/theme").lightTheme }) }));
const meal = { ...createEmptyMealDraft(), id: "tacos", title: "Tacos" };
const props = {
  day: "mon" as const, meals: [meal], assignedMeal: meal, history: [], autoFocus: false,
  onSelectMeal: jest.fn(), onSelectEatOut: jest.fn(), onSelectFlexNight: jest.fn(),
  onEditSides: jest.fn(), onViewDetails: jest.fn(), onRemove: jest.fn(), onExpandedLayout: jest.fn(),
};

it("requests the main day-selection flow without opening an inline destination list", () => {
  const onRequestSwap = jest.fn();
  const screen = render(<InlineDaySearch {...props} onRequestSwap={onRequestSwap} />);
  fireEvent.press(screen.getByText("Swap"));
  expect(onRequestSwap).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Move or Swap")).toBeNull();
});

it("does not offer Swap on an unplanned day", () => {
  const screen = render(<InlineDaySearch {...props} assignedMeal={null} onRequestSwap={jest.fn()} />);
  expect(screen.queryByText("Swap")).toBeNull();
});

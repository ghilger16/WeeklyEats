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

it("finds ingredients outside meal titles and filters to meals using the selected ingredient", () => {
  const pasta = { ...meal, id: "pasta", title: "Creamy Pasta", ingredients: [{ name: "Mushrooms", category: "produce" as const, ingredientType: "keyIngredient" as const }] };
  const soup = { ...meal, id: "soup", title: "Soup", ingredients: ["Mushrooms"] };
  const onSelectMeal = jest.fn();
  const screen = render(<InlineDaySearch {...props} meals={[meal, pasta, soup]} onSelectMeal={onSelectMeal} />);
  const input = screen.getByPlaceholderText("Search meals or ingredients…");
  fireEvent.changeText(input, "MUSH");
  expect(screen.getByText("2 meals")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Show meals with Mushrooms"));
  expect(screen.queryByPlaceholderText("Search meals or ingredients…")).toBeNull();
  expect(screen.getByText("Creamy Pasta")).toBeTruthy();
  expect(screen.getByText("Soup")).toBeTruthy();
  expect(screen.queryByText("Tacos")).toBeNull();
  fireEvent.press(screen.getByText("Creamy Pasta"));
  expect(onSelectMeal).toHaveBeenCalledWith(pasta);
  fireEvent.press(screen.getByLabelText("Clear ingredient filter"));
  fireEvent.changeText(screen.getByPlaceholderText("Search meals or ingredients…"), "taco");
  expect(screen.getByText("Tacos")).toBeTruthy();
  expect(screen.queryByText("Creamy Pasta")).toBeNull();
});

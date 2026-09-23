import { fireEvent, render } from "@testing-library/react-native";
import { Modal } from "react-native";
import SuggestMealModal from "../components/plan-week/suggestions/SuggestMealModal";
import { Meal } from "../types/meals";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
jest.mock("../providers/theme/ThemeController", () => ({
  useThemeController: () => ({ theme: require("../styles/theme").lightTheme }),
}));
jest.mock("../components/plan-week/DayPinsControls", () => () => null);
jest.mock("../components/plan-week/inline/InlineAddMealEditor", () => () => null);
jest.mock("../components/plan-week/inline/InlineEatOutEditor", () => () => null);
jest.mock("../components/plan-week/inline/InlineDaySearch", () => (props: any) => {
  const { Pressable, Text } = require("react-native");
  return <Pressable onPress={() => props.onSelectMeal(props.meals[0])}><Text>Choose Pasta</Text></Pressable>;
});
jest.mock("../components/plan-week/inline/InlineSideEditor", () => (props: any) => {
  const { Pressable, Text } = require("react-native");
  return <Pressable onPress={() => props.onDone(["Salad"])}><Text>Continue with Salad</Text></Pressable>;
});

it("selects a replacement and forwards its sides for confirmation inside the existing modal", () => {
  const meal = { id: "pasta", title: "Pasta" } as Meal;
  const onAddMealWithSides = jest.fn();
  const onDismiss = jest.fn();
  const screen = render(<SuggestMealModal embedded visible mode="changeDinner"
    dayName="Wednesday" dayKey="wed" meals={[meal]}
    onDismiss={onDismiss} onAddMeal={jest.fn()}
    onAddMealWithSides={onAddMealWithSides} onSuggestAnother={jest.fn()} />);

  expect(screen.getByText("Change Wednesday's Dinner")).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  fireEvent.press(screen.getByText("Choose Pasta"));
  expect(screen.getByText("Selected Meal")).toBeTruthy();
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Continue with Salad"));
  expect(onAddMealWithSides).toHaveBeenCalledWith(meal, ["Salad"]);
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
});

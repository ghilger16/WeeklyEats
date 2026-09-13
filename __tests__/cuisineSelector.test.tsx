import { useState } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import CuisineSelectorModal from "../components/meals/CuisineSelectorModal";
import { CuisineType } from "../types/cuisine";
import { saveCuisineSides } from "../stores/cuisineSidesStorage";
jest.mock("../hooks/useCuisineSides", () => ({ useCuisineSides: () => ({}) }));
jest.mock("../stores/cuisineSidesStorage", () => ({
  normalizeCuisineSides: (sides: string[]) => sides.filter((side) => side.trim()),
  saveCuisineSides: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../providers/theme/ThemeController", () => ({ useThemeController: () => ({ theme: require("../styles/theme").darkTheme }) }));
jest.mock("../components/emoji/MealEmoji", () => "MealEmoji");
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
const select = jest.fn();
function Picker() {
  const [selected, setSelected] = useState<CuisineType | null>("american");
  return <CuisineSelectorModal embedded visible selected={selected} mealTitle="Dinner" onClose={jest.fn()} onSelect={(value) => { select(value); setSelected(value); }} />;
}
beforeEach(() => jest.clearAllMocks());
it("shows text-only defaults and changes cuisine without selecting sides", () => {
  const screen = render(<Picker />);
  expect(screen.getByText("Mashed Potatoes")).toBeTruthy();
  expect(screen.getByText(/Sides for American · 6/)).toBeTruthy();
  expect(select).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Italian"));
  expect(screen.getByText(/Sides for Italian · 6/)).toBeTruthy();
  expect(screen.getByText("Garlic Bread")).toBeTruthy();
  expect(select).toHaveBeenCalledWith("italian");
  expect(saveCuisineSides).not.toHaveBeenCalled();
});
it("lets users replace, remove, and add a side before saving", async () => {
  const screen = render(<Picker />);
  fireEvent.press(screen.getByText("Customize"));
  expect(screen.getByLabelText("Add a side").props.editable).toBe(true);
  fireEvent.changeText(screen.getByLabelText("Suggested side 4"), "Baked Beans");
  fireEvent.press(screen.getByLabelText("Remove side 6"));
  fireEvent.changeText(screen.getByLabelText("Add a side"), "Roasted Carrots");
  fireEvent.press(screen.getByLabelText("Add custom side"));
  await act(async () => fireEvent.press(screen.getByText("Save")));
  expect(saveCuisineSides).toHaveBeenCalledWith("american", ["Mashed Potatoes", "Green Beans", "Mac & Cheese", "Baked Beans", "Dinner Rolls", "Roasted Carrots"]);
  expect(select).not.toHaveBeenCalled();
});
it("discards unsaved customization when switching cuisine", () => {
  const screen = render(<Picker />);
  fireEvent.press(screen.getByText("Customize"));
  fireEvent.changeText(screen.getByLabelText("Suggested side 1"), "Unsaved");
  fireEvent.press(screen.getByText("Italian"));
  expect(screen.queryByDisplayValue("Unsaved")).toBeNull();
  expect(saveCuisineSides).not.toHaveBeenCalled();
});

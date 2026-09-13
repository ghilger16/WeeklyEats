import { act, fireEvent, render } from "@testing-library/react-native";
import InlineAddMealEditor from "../components/plan-week/inline/InlineAddMealEditor";
import { autoFillMealFromUrl, RecipeAutoFillOutcome } from "../utils/recipeAutoFill";

jest.mock("../hooks/useFamilyMembers", () => ({ useFamilyMembers: () => ({ members: [] }) }));
jest.mock("../utils/recipeAutoFill", () => ({ autoFillMealFromUrl: jest.fn() }));
jest.mock("../hooks/useFeatureFlags", () => ({ useFeatureFlag: () => true }));
jest.mock("../utils/recipeAutoFillCapability", () => ({ supportsRecipeAutoFill: () => true }));
jest.mock("../providers/theme/ThemeController", () => ({
  useThemeController: () => ({ theme: require("../styles/theme").lightTheme }),
}));
jest.mock("../utils/ingredientClassification", () => ({
  classifyIngredients: jest.fn(async (ingredients) => ingredients),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));

const request = autoFillMealFromUrl as jest.Mock;
const success: RecipeAutoFillOutcome = {
  ok: true,
  data: { title: "Chicken Parmesan", ingredients: [{ name: "Chicken", category: "meat", ingredientType: "keyIngredient" }], difficulty: 2, expense: 4, prepNotes: "Bake.", suggestedSides: ["Salad"] },
};
function setup() {
  const onImport = jest.fn();
  const onSave = jest.fn();
  const screen = render(<InlineAddMealEditor day="fri" onBack={jest.fn()} onSave={onSave} onImport={onImport} onExpandedLayout={jest.fn()} />);
  const openRecipe = () => {
    fireEvent.press(screen.getByText("Add from Recipe Link"));
    fireEvent.changeText(screen.getByLabelText("Recipe link for Friday"), "https://example.com/recipe");
  };
  return { ...screen, onImport, onSave, openRecipe };
}

beforeEach(() => { jest.clearAllMocks(); });

it("keeps title quick-add as the default", () => {
  const screen = setup();
  fireEvent.changeText(screen.getByPlaceholderText("Meal title"), "Tacos");
  fireEvent.press(screen.getByText("Save & Plan"));
  expect(screen.onSave).toHaveBeenCalledWith("Tacos");
  expect(request).not.toHaveBeenCalled();
});

it("imports once, showing shared progress inline and saving all recipe details", async () => {
  let resolve!: (outcome: RecipeAutoFillOutcome) => void;
  request.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const screen = setup();
  screen.openRecipe();
  const submit = screen.getByText("Auto Fill & Plan");
  act(() => { fireEvent.press(submit); fireEvent.press(submit); });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("https://example.com/recipe", undefined, 4);
  expect(screen.getByText("Creating your meal…")).toBeTruthy();
  await act(async () => resolve(success));
  expect(screen.onImport).toHaveBeenCalledTimes(1);
  expect(screen.onImport).toHaveBeenCalledWith(expect.objectContaining({ title: "Chicken Parmesan", recipeUrl: "https://example.com/recipe", servedCount: 0, difficulty: 3, expense: 4, prepNotes: "Bake.", preferredSides: ["Salad"], ingredients: success.ok ? success.data.ingredients : [] }));
  expect(screen.onSave).not.toHaveBeenCalled();
});

it("preserves the URL and shared error for retry", async () => {
  request.mockResolvedValueOnce({ ok: false, error: "Recipe not found" }).mockResolvedValueOnce(success);
  const screen = setup();
  screen.openRecipe();
  await act(async () => fireEvent.press(screen.getByText("Auto Fill & Plan")));
  expect(screen.getByText("Recipe not found")).toBeTruthy();
  expect(screen.getByLabelText("Recipe link for Friday").props.value).toBe("https://example.com/recipe");
  await act(async () => fireEvent.press(screen.getByText("Auto Fill & Plan")));
  expect(screen.onImport).toHaveBeenCalledTimes(1);
});

it.each(["close", "quick"])("does not save an in-flight import after %s", async (action) => {
  let resolve!: (outcome: RecipeAutoFillOutcome) => void;
  request.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const screen = setup();
  screen.openRecipe();
  fireEvent.press(screen.getByText("Auto Fill & Plan"));
  if (action === "close") screen.unmount();
  else fireEvent.press(screen.getByText("Back to Quick Add"));
  await act(async () => resolve(success));
  expect(screen.onImport).not.toHaveBeenCalled();
  if (action === "quick") expect(screen.getByPlaceholderText("Meal title")).toBeTruthy();
});

it("does not save a successful response without a meal title", async () => {
  request.mockResolvedValue({ ok: true, data: { ingredients: [] } });
  const screen = setup();
  screen.openRecipe();
  await act(async () => fireEvent.press(screen.getByText("Auto Fill & Plan")));
  expect(screen.onImport).not.toHaveBeenCalled();
  expect(screen.getByText(/couldn’t find a meal title/)).toBeTruthy();
});

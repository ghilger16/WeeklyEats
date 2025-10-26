import { act, fireEvent, render } from "@testing-library/react-native";
import MealsScreen from "../index";
import { useMeals } from "../../../../hooks/useMeals";
import { Meal } from "../../../../types/meals";

jest.mock("../../../../hooks/useMeals");
jest.mock("../../../../providers/theme/ThemeController", () => {
  const { darkTheme } = jest.requireActual("../../../../styles/theme");
  return {
    useThemeController: jest.fn().mockReturnValue({
      theme: darkTheme,
      preference: "system" as const,
      setPreference: jest.fn().mockResolvedValue(undefined),
      isHydrated: true,
    }),
  };
});

const mockMeals: Meal[] = [
  {
    id: "tacos",
    title: "Tacos",
    emoji: "🌮",
    rating: 3,
    plannedCostTier: 1,
    locked: false,
    isFavorite: true,
  },
  {
    id: "pizza",
    title: "Pizza",
    emoji: "🍕",
    rating: 4,
    plannedCostTier: 2,
    locked: false,
    isFavorite: false,
  },
];

const mockUseMeals = useMeals as jest.MockedFunction<typeof useMeals>;

const createHookReturn = (overrides?: Partial<ReturnType<typeof useMeals>>) => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  return {
    meals: mockMeals,
    favorites: mockMeals.filter((meal) => meal.isFavorite),
    isRefreshing: false,
    refresh,
    toggleFavorite: jest.fn(),
    toggleLock: jest.fn(),
    deleteMeal: jest.fn(),
    ...overrides,
  };
};

describe("MealsScreen", () => {
  beforeEach(() => {
    mockUseMeals.mockReturnValue(createHookReturn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders meal list header and items", () => {
    const { getByText, getByTestId } = render(<MealsScreen />);

    expect(getByText("Weekly Eats")).toBeTruthy();
    expect(getByText("Meals")).toBeTruthy();
    expect(getByTestId("meals-list")).toBeTruthy();
    expect(getByText("Tacos")).toBeTruthy();
    expect(getByText("Pizza")).toBeTruthy();
  });

  it("opens the meal modal overlay on press", () => {
    const { getByTestId, getByText } = render(<MealsScreen />);

    fireEvent.press(getByTestId("meal-item-tacos"));

    expect(getByText("Edit Meal")).toBeTruthy();
  });

  it("triggers refresh control handler", async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockUseMeals.mockReturnValue(
      createHookReturn({
        refresh,
      })
    );

    const { getByTestId } = render(<MealsScreen />);
    const refreshControl = getByTestId("meals-refresh-control");

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

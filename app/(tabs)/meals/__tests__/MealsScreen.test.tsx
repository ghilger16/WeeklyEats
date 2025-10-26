import { act, fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import MealsScreen from "../index";
import { useMeals } from "../../../../hooks/useMeals";
import { Meal } from "../../../../types/meals";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../../../hooks/useMeals");

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
const mockRouter = useRouter as jest.Mock;

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
    mockRouter.mockReturnValue({ push: jest.fn() });
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

  it("navigates to the meal editor modal on press", () => {
    const push = jest.fn();
    mockRouter.mockReturnValue({ push });

    const { getByTestId } = render(<MealsScreen />);

    fireEvent.press(getByTestId("meal-item-tacos"));

    expect(push).toHaveBeenCalledWith({
      pathname: "/modals/meal-editor",
      params: { mealId: "tacos" },
    });
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

import { act, fireEvent, render } from "@testing-library/react-native";
import MealsScreen from "../index";
import { useMeals } from "../../../../hooks/useMeals";
import { Meal } from "../../../../types/meals";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../../../../hooks/useMeals");
jest.mock("../../../../utils/pendingRecipeImports", () => ({
  getPendingRecipeImports: jest.fn(() => new Promise(() => {})),
  removePendingRecipeImport: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../components/meals/MealListItem", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return function MockMealListItem({
    meal,
    onPress,
  }: {
    meal: Meal;
    onPress: () => void;
  }) {
    return React.createElement(
      Pressable,
      { testID: `meal-item-${meal.id}`, onPress },
      React.createElement(Text, null, meal.title)
    );
  };
});
jest.mock("../../../../components/meals/MealModalOverlay", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockMealModalOverlay({
    visible,
    mode,
  }: {
    visible: boolean;
    mode: "create" | "edit";
  }) {
    if (!visible) {
      return null;
    }
    return React.createElement(
      Text,
      null,
      mode === "edit" ? "Edit Meal" : "Add Meal"
    );
  };
});
jest.mock("../../../../components/meals/FreezerAmountModal", () => {
  return function MockFreezerAmountModal() {
    return null;
  };
});
jest.mock("../../../../components/meals/DisplayOnCardsSheet", () => {
  return function MockDisplayOnCardsSheet() {
    return null;
  };
});
jest.mock("../../../../components/meals/MealSearchModal", () => {
  return function MockMealSearchModal() {
    return null;
  };
});
jest.mock("../../../../components/meals/MealTabs", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return function MockMealTabs({
    onChange,
  }: {
    onChange: (tab: "all" | "favorites") => void;
  }) {
    return React.createElement(
      View,
      null,
      React.createElement(
        Pressable,
        { onPress: () => onChange("all") },
        React.createElement(Text, null, "All")
      ),
      React.createElement(
        Pressable,
        { onPress: () => onChange("favorites") },
        React.createElement(Text, null, "Freezer")
      )
    );
  };
});
jest.mock("../../../../components/meals/MealSearchInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockMealSearchInput({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) {
    return React.createElement(TextInput, {
      placeholder: "Search meals",
      value,
      onChangeText,
    });
  };
});
jest.mock("../../../../components/tab-parent/TabParent", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return function MockTabParent({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, "Weekly Eats"),
      React.createElement(Text, null, title),
      children
    );
  };
});
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    RectButton: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement(View, { onPress }, children),
    Swipeable: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});
jest.mock("../../../../hooks/useFamilyMembers", () => ({
  useFamilyMembers: jest.fn().mockReturnValue({ members: [] }),
}));
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});
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
    servedCount: 0,
    showServedCount: false,
   plannedCostTier: 1,
   locked: false,
   isFavorite: true,
  },
  {
   id: "pizza",
   title: "Pizza",
   emoji: "🍕",
   rating: 4,
    servedCount: 0,
    showServedCount: false,
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
    addMeal: jest.fn(),
    updateMeal: jest.fn(),
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
    const refreshControl = getByTestId("meals-list").props.refreshControl;

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

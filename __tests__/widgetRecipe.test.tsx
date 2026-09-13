import { render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import WidgetRecipeRedirect from "../app/widget-recipe";

const mockReplace = jest.fn();
let mockUrl = "https://example.com/recipe?a=1&b=2";
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ url: mockUrl }),
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

it("opens the recipe externally and returns to the dashboard", async () => {
  mockUrl = "https://example.com/recipe?a=1&b=2";
  render(<WidgetRecipeRedirect />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/week-dashboard"));
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(mockUrl);
});

it.each(["weeklyeats://week", "javascript:alert(1)", "invalid"])("does not open unsupported URL %s", async (url) => {
  mockUrl = url;
  render(<WidgetRecipeRedirect />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  expect(Linking.openURL).not.toHaveBeenCalled();
});

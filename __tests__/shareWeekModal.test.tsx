import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import ShareWeekModal from "../components/share-week/ShareWeekModal";
import { captureRef, releaseCapture } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { WeekPlanDay } from "../hooks/useCurrentWeekPlan";
import { Alert, TurboModuleRegistry } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
jest.mock("expo-modules-core", () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async () => "file:///card.png"), releaseCapture: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View, SafeAreaProvider: require("react-native").View, initialWindowMetrics: { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } } }));
jest.mock("../providers/theme/ThemeController", () => ({ useThemeController: () => ({ theme: { color: { bg: "white", ink: "black", surfaceAlt: "gray", accent: "pink", border: "gray" } } }) }));
const days = [{ key: "mon", label: "Mon", plannedDate: new Date(2026, 8, 14), mealId: "tacos", meal: { id: "tacos", title: "Tacos", emoji: "🌮" }, sides: ["Rice"] }] as WeekPlanDay[];
const originalGet = TurboModuleRegistry.get;
let captureAvailable = true;
beforeEach(() => {
  jest.clearAllMocks();
  captureAvailable = true;
  jest.spyOn(TurboModuleRegistry, "get").mockImplementation(name => name === "RNViewShot" ? (captureAvailable ? {} : null) as never : originalGet(name));
  jest.mocked(requireOptionalNativeModule).mockReturnValue({} as never);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
it("allows selecting a style without swiping and shares only the card", async () => {
  const screen = render(<ShareWeekModal days={days} onClose={jest.fn()} />, { createNodeMock: () => ({}) });
  fireEvent.press(screen.getByLabelText("Warm style"));
  expect(screen.getByLabelText("Warm style").props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText("Share Week"));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///card.png", expect.objectContaining({ mimeType: "image/png" })));
  expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1350, format: "png" }));
  await waitFor(() => expect(releaseCapture).toHaveBeenCalledWith("file:///card.png"));
});

it("keeps one stationary foreground while only backgrounds swipe", () => {
  const screen = render(<ShareWeekModal days={days} onClose={jest.fn()} />);
  const foreground = screen.getByTestId("share-week-foreground");
  const pager = screen.getByTestId("share-background-pager");
  expect(within(pager).queryByText("Tacos")).toBeNull();
  expect(screen.getAllByText("Tacos")).toHaveLength(1);
  fireEvent(pager, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: pager.props.style.width * 2 } } });
  expect(screen.getByLabelText("Warm style").props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId("share-week-foreground")).toBe(foreground);
  expect(within(foreground).getByText("Tacos")).toBeTruthy();
});

it("switches the shared week while keeping the selected background", async () => {
  const nextDays = [{ ...days[0], plannedDate: new Date(2026, 8, 21), plannedDateISO: "2026-09-21", meal: { ...days[0].meal!, title: "Pasta" } }];
  const screen = render(<ShareWeekModal days={days} nextDays={nextDays} onClose={jest.fn()} />, { createNodeMock: () => ({}) });
  fireEvent.press(screen.getByLabelText("Warm style"));
  fireEvent.press(screen.getByLabelText("Share next week"));
  expect(screen.queryByText("Tacos")).toBeNull();
  expect(screen.getByText("Pasta")).toBeTruthy();
  expect(screen.getByLabelText("Warm style").props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText("Share Week"));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
  fireEvent.press(screen.getByLabelText("Share current week"));
  expect(screen.getByText("Tacos")).toBeTruthy();
});

it("hides the week selector when only one week is available", () => {
  const screen = render(<ShareWeekModal days={days} onClose={jest.fn()} />);
  expect(screen.queryByLabelText("Share next week")).toBeNull();
});

it("cycles card headings in order and wraps to the first title", () => {
  const screen = render(<ShareWeekModal days={days} onClose={jest.fn()} />);
  expect(screen.getByLabelText("Tap to cycle heading")).toBeTruthy();
  const titles = ["This Week's Dinner", "Family Dinner Plan", "What's For Dinner?", "Dinner Plan"];
  titles.forEach((title, index) => {
    fireEvent.press(screen.getByLabelText(`Change heading: ${title}`));
    expect(screen.queryByLabelText("Tap to cycle heading")).toBeNull();
    expect(screen.getByText(titles[(index + 1) % titles.length])).toBeTruthy();
  });
});

it.each(["capture", "sharing"])("keeps preview usable when the native %s module is missing", async (missing) => {
  if (missing === "capture") captureAvailable = false;
  else jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  const screen = render(<ShareWeekModal days={days} onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Share Week"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("App update needed", expect.any(String)));
  expect(captureRef).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Warm style"));
  expect(screen.getByLabelText("Warm style").props.accessibilityState.selected).toBe(true);
});

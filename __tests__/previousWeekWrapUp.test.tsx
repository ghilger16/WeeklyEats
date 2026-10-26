import { render } from "@testing-library/react-native";
import { WrapUpLastWeekModal } from "../components/week-dashboard/PreviousWeekCatchUp";
import ThisWeekList from "../components/week-dashboard/ThisWeekList";
import { WeekPlanDay } from "../hooks/useCurrentWeekPlan";
import { ServedMealEntry } from "../stores/servedMealsStorage";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
jest.mock("expo-haptics", () => ({}));
jest.mock("../providers/theme/ThemeController", () => ({
  useThemeController: () => ({ theme: require("../styles/theme").lightTheme }),
}));
jest.mock("../components/week-dashboard/ThisWeekList", () => jest.fn(() => null));

it("retains reviewed rows with live status data until the wrap-up closes", () => {
  const first = { key: "wed", plannedDateISO: "2026-09-30", meal: { title: "Stir Fry" } } as WeekPlanDay;
  const second = { key: "thu", plannedDateISO: "2026-10-01", meal: { title: "Nuggets" } } as WeekPlanDay;
  const props = { visible: true, days: [first, second], allDays: [first, second], servedEntries: [] as ServedMealEntry[],
    onDayPress: jest.fn(), onContinue: jest.fn(), onClose: jest.fn() };
  const screen = render(<WrapUpLastWeekModal {...props} />);
  const entries = [{ dayKey: "wed", outcome: "served", servedAtISO: "2026-09-30" }] as ServedMealEntry[];
  const listProps = () => (ThisWeekList as jest.Mock).mock.calls.at(-1)[0];
  screen.rerender(<WrapUpLastWeekModal {...props} days={[second]} servedEntries={entries} />);
  expect(listProps().days).toEqual([first, second]);
  expect(listProps().servedEntries).toBe(entries);
  expect(screen.getByText(/You still have 1 meal/)).toBeTruthy();
  screen.rerender(<WrapUpLastWeekModal {...props} days={[]} servedEntries={entries} />);
  expect(listProps().days).toEqual([first, second]);
  expect(screen.getByText("All caught up!")).toBeTruthy();
  screen.rerender(<WrapUpLastWeekModal {...props} visible={false} days={[]} />);
  screen.rerender(<WrapUpLastWeekModal {...props} days={[second]} />);
  expect(listProps().days).toEqual([second]);
});

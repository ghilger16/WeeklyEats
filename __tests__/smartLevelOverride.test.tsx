import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSmartLevelTestOverride, useSmartLevel } from "../hooks/useSmartLevel";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

it("updates all Smart Level consumers, persists the override, and restores the calculated level", async () => {
  const input = { meals: [], servedEntries: [], plannedWeeksCount: 0 };
  const first = renderHook(() => useSmartLevel(input));
  const second = renderHook(() => useSmartLevel(input));
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  expect(first.result.current).toBe(1);
  await act(async () => { await setSmartLevelTestOverride(5); });
  expect(first.result.current).toBe(5);
  expect(second.result.current).toBe(5);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("@weeklyeats/debugSmartLevel", "5");
  await act(async () => { await setSmartLevelTestOverride(null); });
  expect(first.result.current).toBe(1);
  expect(second.result.current).toBe(1);
});

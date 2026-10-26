import { act, render } from "@testing-library/react-native";
import { AppState, AppStateStatus, DeviceEventEmitter } from "react-native";
import WidgetCoordinator from "../services/widget/WidgetCoordinator";
import { syncWidgetState } from "../services/widget/syncWidgetState";
import { WIDGET_DATA_CHANGED } from "../services/widget/widgetEvents";
import { localDayAndZone } from "../utils/widgetCalendar";

jest.mock("../services/widget/syncWidgetState", () => ({ syncWidgetState: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../utils/widgetCalendar", () => ({ localDayAndZone: jest.fn(() => "Monday/Phoenix") }));

it("syncs at startup, persisted changes, foreground day/zone changes and app resume, then cleans up", () => {
  jest.useFakeTimers();
  const priorState = AppState.currentState;
  AppState.currentState = "active";
  let onState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const subscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
    onState = callback;
    return { remove };
  });
  const screen = render(<WidgetCoordinator />);
  try {
    expect(syncWidgetState).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(syncWidgetState).toHaveBeenCalledTimes(1);
    act(() => { DeviceEventEmitter.emit(WIDGET_DATA_CHANGED); });
    expect(syncWidgetState).toHaveBeenCalledTimes(2);
    (localDayAndZone as jest.Mock).mockReturnValue("Tuesday/Phoenix");
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(syncWidgetState).toHaveBeenCalledTimes(3);
    (localDayAndZone as jest.Mock).mockReturnValue("Tuesday/Tokyo");
    act(() => { onState("active"); });
    expect(syncWidgetState).toHaveBeenCalledTimes(4);
    screen.unmount();
    act(() => { DeviceEventEmitter.emit(WIDGET_DATA_CHANGED); jest.advanceTimersByTime(60_000); });
    expect(syncWidgetState).toHaveBeenCalledTimes(4);
    expect(remove).toHaveBeenCalled();
  } finally {
    subscription.mockRestore(); AppState.currentState = priorState; jest.useRealTimers();
  }
});

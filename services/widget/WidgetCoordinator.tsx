import { useEffect } from "react";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { syncWidgetState } from "./syncWidgetState";
import { WIDGET_DATA_CHANGED } from "./widgetEvents";
import { localDayAndZone } from "../../utils/widgetCalendar";

export default function WidgetCoordinator() {
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let lastDayAndZone = localDayAndZone(new Date());
    const refresh = () => {
      lastDayAndZone = localDayAndZone(new Date());
      void syncWidgetState().catch((error) => console.warn("[WeeklyEatsWidget] sync failed", error));
    };
    const changed = DeviceEventEmitter.addListener(WIDGET_DATA_CHANGED, refresh);
    const active = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    // Foreground midnight/timezone fallback; WidgetKit owns rollover while closed.
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && localDayAndZone(new Date()) !== lastDayAndZone) refresh();
    }, 60_000);
    refresh();
    return () => { changed.remove(); active.remove(); clearInterval(timer); };
  }, []);
  return null;
}

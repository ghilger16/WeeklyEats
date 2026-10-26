import { DeviceEventEmitter } from "react-native";

export const WIDGET_DATA_CHANGED = "weeklyEatsWidgetDataChanged";
// Emitted only after persisted widget source data changes, never by UI renders.
export const notifyWidgetDataChanged = () => DeviceEventEmitter.emit(WIDGET_DATA_CHANGED);

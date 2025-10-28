import { Platform } from "react-native";

/**
 * Placeholder capability check for Apple on-device intelligence.
 * Replace with real detection once Apple exposes their runtime APIs.
 */
export const supportsRecipeAutoFill = (): boolean => {
  // iOS 18+ is the first release with Apple Intelligence. Until we can
  // query the OS directly, gate behind a simple platform check so the UI can
  // be toggled on during development.
  return Platform.OS === "ios";
};

import { MaterialCommunityIcons } from "@expo/vector-icons";

export type ServedOutcome =
  | "served"
  | "cookedAlt"
  | "ateOut"
  | "skipped";

export type ServedAction = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: ServedOutcome;
};

export const SERVED_ACTIONS: ServedAction[] = [
  { icon: "check-circle", label: "Served", value: "served" },
  { icon: "refresh", label: "Swapped", value: "cookedAlt" },
  { icon: "silverware-fork-knife", label: "Ate out", value: "ateOut" },
  { icon: "close-circle", label: "Skipped", value: "skipped" },
];

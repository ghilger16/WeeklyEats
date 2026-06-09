import { PlannedWeekDayKey } from "./weekPlan";

export type GroceryCategory =
  | "produce"
  | "meat"
  | "dairy"
  | "pantry"
  | "frozen"
  | "bakery"
  | "beverages"
  | "other";

export type GroceryListViewMode = "meal" | "category";

export type GroceryListItem = {
  id: string;
  name: string;
  category: GroceryCategory;
  source: "planned" | "manual";
  mealId?: string;
  mealTitle?: string;
  mealEmoji?: string;
  dayKey?: PlannedWeekDayKey;
  dayLabel?: string;
  dayName?: string;
  sortIndex: number;
};

export type GroceryList = {
  weekId: string;
  generatedFromPlan: boolean;
  items: GroceryListItem[];
  manualItems: GroceryListItem[];
  checkedItems: string[];
  createdAtISO: string;
  updatedAtISO: string;
};

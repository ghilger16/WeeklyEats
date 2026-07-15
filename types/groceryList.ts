import { PlannedWeekDayKey } from "./weekPlan";
import { IngredientType } from "./meals";
import { ShoppingCategory } from "./meals";

export type GroceryCategory = ShoppingCategory;

export type GroceryListViewMode = "meal" | "category";

export type GroceryListItem = {
  id: string;
  name: string;
  category: GroceryCategory;
  ingredientType?: IngredientType;
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

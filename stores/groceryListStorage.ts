import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GroceryList,
  GroceryListItem,
  GroceryListViewMode,
} from "../types/groceryList";

const GROCERY_LISTS_KEY = "@weeklyeats/groceryListsByWeek";
const GROCERY_VIEW_MODE_KEY = "@weeklyeats/groceryListViewMode";

type GroceryListMap = Record<string, GroceryList>;

const isGroceryList = (value: unknown): value is GroceryList =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as GroceryList).weekId === "string" &&
  Array.isArray((value as GroceryList).items) &&
  Array.isArray((value as GroceryList).manualItems) &&
  Array.isArray((value as GroceryList).checkedItems);

const normalizeList = (value: unknown): GroceryList | null => {
  if (!isGroceryList(value)) {
    return null;
  }
  return {
    ...value,
    generatedFromPlan: Boolean(value.generatedFromPlan),
    items: value.items.filter(Boolean),
    manualItems: value.manualItems.filter(Boolean),
    checkedItems: value.checkedItems.filter(
      (item): item is string => typeof item === "string"
    ),
    createdAtISO:
      typeof value.createdAtISO === "string"
        ? value.createdAtISO
        : new Date().toISOString(),
    updatedAtISO:
      typeof value.updatedAtISO === "string"
        ? value.updatedAtISO
        : new Date().toISOString(),
  };
};

const getListMap = async (): Promise<GroceryListMap> => {
  try {
    const raw = await AsyncStorage.getItem(GROCERY_LISTS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed as Record<string, unknown>).reduce<GroceryListMap>(
      (acc, [weekId, value]) => {
        const list = normalizeList(value);
        if (list) {
          acc[weekId] = list;
        }
        return acc;
      },
      {}
    );
  } catch (error) {
    console.warn("[groceryListStorage] Failed to read grocery lists", error);
    return {};
  }
};

const setListMap = async (map: GroceryListMap): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROCERY_LISTS_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("[groceryListStorage] Failed to write grocery lists", error);
  }
};

export const getGroceryListForWeek = async (
  weekId: string
): Promise<GroceryList | null> => {
  const map = await getListMap();
  return map[weekId] ?? null;
};

export const setGroceryListForWeek = async (
  weekId: string,
  list: GroceryList
): Promise<void> => {
  const map = await getListMap();
  map[weekId] = {
    ...list,
    weekId,
    updatedAtISO: new Date().toISOString(),
  };
  await setListMap(map);
};

export const createGroceryList = (
  weekId: string,
  items: GroceryListItem[]
): GroceryList => {
  const now = new Date().toISOString();
  return {
    weekId,
    generatedFromPlan: true,
    items,
    manualItems: [],
    checkedItems: [],
    createdAtISO: now,
    updatedAtISO: now,
  };
};

export const getGroceryListViewMode =
  async (): Promise<GroceryListViewMode> => {
    try {
      const raw = await AsyncStorage.getItem(GROCERY_VIEW_MODE_KEY);
      return raw === "category" ? "category" : "meal";
    } catch {
      return "meal";
    }
  };

export const setGroceryListViewMode = async (
  mode: GroceryListViewMode
): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROCERY_VIEW_MODE_KEY, mode);
  } catch (error) {
    console.warn("[groceryListStorage] Failed to write view mode", error);
  }
};


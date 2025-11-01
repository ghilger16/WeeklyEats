import AsyncStorage from "@react-native-async-storage/async-storage";
import { Meal } from "../types/meals";

const MEALS_STORAGE_KEY = "@weeklyeats/meals";

const applyMealDefaults = (meal: Meal): Meal => ({
  ...meal,
  servedCount:
    typeof meal.servedCount === "number" && meal.servedCount >= 0
      ? meal.servedCount
      : 0,
  showServedCount: Boolean(meal.showServedCount),
});

const parseMeals = (raw: string | null): Meal[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is Meal =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as Meal).id === "string"
      )
      .map(applyMealDefaults);
  } catch (error) {
    console.warn("[mealsStorage] Failed to parse meals from storage", error);
    return [];
  }
};

const serializeMeals = (meals: Meal[]): string => {
  try {
    return JSON.stringify(meals);
  } catch (error) {
    console.warn("[mealsStorage] Failed to serialize meals", error);
    return "[]";
  }
};

export const getMeals = async (): Promise<Meal[]> => {
  try {
    const raw = await AsyncStorage.getItem(MEALS_STORAGE_KEY);
    return parseMeals(raw);
  } catch (error) {
    console.warn("[mealsStorage] Failed to get meals", error);
    return [];
  }
};

export const setMeals = async (meals: Meal[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(MEALS_STORAGE_KEY, serializeMeals(meals));
  } catch (error) {
    console.warn("[mealsStorage] Failed to persist meals", error);
  }
};

export const addMeal = async (meal: Meal): Promise<Meal[]> => {
  const meals = await getMeals();
  const normalized = applyMealDefaults(meal);
  const next = [
    normalized,
    ...meals.filter((existing) => existing.id !== normalized.id),
  ];
  await setMeals(next);
  return next;
};

export const updateMeal = async (meal: Meal): Promise<Meal[]> => {
  const meals = await getMeals();
  const next = meals.map((existing) =>
    existing.id === meal.id
      ? applyMealDefaults({ ...existing, ...meal })
      : existing
  );
  await setMeals(next);
  return next;
};

export const removeMeal = async (id: string): Promise<Meal[]> => {
  const meals = await getMeals();
  const next = meals.filter((meal) => meal.id !== id);
  await setMeals(next);
  return next;
};

export const clearMeals = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MEALS_STORAGE_KEY);
  } catch (error) {
    console.warn("[mealsStorage] Failed to clear meals", error);
  }
};

export const mealsStorageKey = MEALS_STORAGE_KEY;

import { useCallback, useMemo, useState } from "react";
import { mockMeals } from "../stores/mockMeals";
import { Meal } from "../types/meals";

const cloneMeals = (data: Meal[]) => data.map((meal) => ({ ...meal }));

export type MealListSubset = "meals" | "favorites";

export type UseMealsResult = {
  meals: Meal[];
  favorites: Meal[];
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  toggleLock: (id: string) => void;
  deleteMeal: (id: string) => void;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const useMeals = (): UseMealsResult => {
  const [meals, setMeals] = useState<Meal[]>(() => cloneMeals(mockMeals));
  const [isRefreshing, setRefreshing] = useState(false);

  const favorites = useMemo(
    () => meals.filter((meal) => meal.isFavorite),
    [meals]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await delay(600);
    setMeals(cloneMeals(mockMeals));
    setRefreshing(false);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setMeals((prev) =>
      prev.map((meal) =>
        meal.id === id ? { ...meal, isFavorite: !meal.isFavorite } : meal
      )
    );
  }, []);

  const toggleLock = useCallback((id: string) => {
    setMeals((prev) =>
      prev.map((meal) =>
        meal.id === id ? { ...meal, locked: !meal.locked } : meal
      )
    );
  }, []);

  const deleteMeal = useCallback((id: string) => {
    setMeals((prev) => prev.filter((meal) => meal.id !== id));
  }, []);

  return {
    meals,
    favorites,
    isRefreshing,
    refresh,
    toggleFavorite,
    toggleLock,
    deleteMeal,
  };
};

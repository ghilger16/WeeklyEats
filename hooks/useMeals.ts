import { useCallback, useEffect, useMemo, useState } from "react";
import { getMeals, setMeals as persistMeals } from "../stores/mealsStorage";
import { Meal } from "../types/meals";

export type MealListSubset = "meals" | "favorites";
export type MealUpdate = Partial<Omit<Meal, "id">> & { id: Meal["id"] };

export type UseMealsResult = {
  meals: Meal[];
  favorites: Meal[];
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  addMeal: (meal: Meal) => void;
  updateMeal: (update: MealUpdate) => void;
  toggleFavorite: (id: string) => void;
  toggleLock: (id: string) => void;
  deleteMeal: (id: string) => void;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const useMeals = (): UseMealsResult => {
  const [meals, setMealsState] = useState<Meal[]>([]);
  const [isRefreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateMeals = async () => {
      const storedMeals = await getMeals();

      if (!isMounted) {
        return;
      }

      if (storedMeals.length > 0) {
        setMealsState(storedMeals);
      }
    };

    hydrateMeals();

    return () => {
      isMounted = false;
    };
  }, []);

  const applyAndPersist = useCallback((transform: (prev: Meal[]) => Meal[]) => {
    setMealsState((prev) => {
      const next = transform(prev);
      persistMeals(next);
      return next;
    });
  }, []);

  const favorites = useMemo(
    () => meals.filter((meal) => meal.isFavorite),
    [meals]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await delay(300);
    const storedMeals = await getMeals();
    if (storedMeals.length > 0) {
      setMealsState(storedMeals);
    }
    setRefreshing(false);
  }, []);

  const addMeal = useCallback(
    (meal: Meal) => {
      applyAndPersist((prev) => {
        const filtered = prev.filter((existing) => existing.id !== meal.id);
        return [meal, ...filtered];
      });
    },
    [applyAndPersist]
  );

  const updateMeal = useCallback(
    (update: MealUpdate) => {
      applyAndPersist((prev) =>
        prev.map((meal) =>
          meal.id === update.id ? { ...meal, ...update } : meal
        )
      );
    },
    [applyAndPersist]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      applyAndPersist((prev) =>
        prev.map((meal) =>
          meal.id === id ? { ...meal, isFavorite: !meal.isFavorite } : meal
        )
      );
    },
    [applyAndPersist]
  );

  const toggleLock = useCallback(
    (id: string) => {
      applyAndPersist((prev) =>
        prev.map((meal) =>
          meal.id === id ? { ...meal, locked: !meal.locked } : meal
        )
      );
    },
    [applyAndPersist]
  );

  const deleteMeal = useCallback(
    (id: string) => {
      applyAndPersist((prev) => prev.filter((meal) => meal.id !== id));
    },
    [applyAndPersist]
  );

  return {
    meals,
    favorites,
    isRefreshing,
    refresh,
    addMeal,
    updateMeal,
    toggleFavorite,
    toggleLock,
    deleteMeal,
  };
};

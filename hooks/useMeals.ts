import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

type MealsListener = () => void;

let storeMeals: Meal[] = [];
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<MealsListener>();

const emitMealsChange = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[useMeals] Listener failed", error);
    }
  });
};

const subscribe = (listener: MealsListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const hydrateMeals = async () => {
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        const storedMeals = await getMeals();
        if (storedMeals.length > 0) {
          if (storeMeals.length === 0) {
            storeMeals = storedMeals;
          } else {
            const existingIds = new Set(storeMeals.map((meal) => meal.id));
            const merged = [...storeMeals];
            storedMeals.forEach((meal) => {
              if (!existingIds.has(meal.id)) {
                merged.push(meal);
              }
            });
            storeMeals = merged;
          }
          emitMealsChange();
        }
      } catch (error) {
        console.warn("[useMeals] Failed to hydrate meals", error);
      }
    })();
  }
  await hydrationPromise;
};

const getSnapshot = () => storeMeals;
const getServerSnapshot = () => storeMeals;

export const useMeals = (): UseMealsResult => {
  const [isRefreshing, setRefreshing] = useState(false);
  const hasHydratedRef = useRef(false);
  const meals = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    let mounted = true;
    if (!hasHydratedRef.current) {
      hydrateMeals().finally(() => {
        if (mounted) {
          hasHydratedRef.current = true;
          emitMealsChange();
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const applyAndPersist = useCallback((transform: (prev: Meal[]) => Meal[]) => {
    const base = storeMeals;
    const next = transform(base);
    storeMeals = next;
    persistMeals(next);
    emitMealsChange();
  }, []);

  const favorites = useMemo(
    () => meals.filter((meal) => meal.isFavorite),
    [meals]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await delay(300);
    const storedMeals = await getMeals();
    storeMeals = storedMeals;
    emitMealsChange();
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

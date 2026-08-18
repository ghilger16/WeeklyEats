import { useCallback, useEffect, useRef, useState } from "react";
import {
  AddServedMealInput,
  ServedMealEntry,
  addServedMeal,
  getServedMeals,
  removeServedMeal,
} from "../stores/servedMealsStorage";

export type UseServedMealsResult = {
  entries: ServedMealEntry[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  logServedMeal: (input: AddServedMealInput) => Promise<void>;
  undoServedMeal: (id: ServedMealEntry["id"]) => Promise<void>;
};

export const useServedMeals = (): UseServedMealsResult => {
  const [entries, setEntries] = useState<ServedMealEntry[]>([]);
  const [isLoading, setLoading] = useState(true);
  const hasHydratedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasHydratedRef.current) {
      setLoading(true);
    }
    const stored = await getServedMeals();
    setEntries(stored);
    hasHydratedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logServedMeal = useCallback(
    async (input: AddServedMealInput) => {
      const next = await addServedMeal(input);
      setEntries(next);
    },
    []
  );

  const undoServedMeal = useCallback(async (id: ServedMealEntry["id"]) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    const next = await removeServedMeal(id);
    setEntries(next);
  }, []);

  return {
    entries,
    isLoading,
    refresh: load,
    logServedMeal,
    undoServedMeal,
  };
};

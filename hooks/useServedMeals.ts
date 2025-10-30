import { useCallback, useEffect, useState } from "react";
import {
  AddServedMealInput,
  ServedMealEntry,
  addServedMeal,
  getServedMeals,
} from "../stores/servedMealsStorage";

export type UseServedMealsResult = {
  entries: ServedMealEntry[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  logServedMeal: (input: AddServedMealInput) => Promise<void>;
};

export const useServedMeals = (): UseServedMealsResult => {
  const [entries, setEntries] = useState<ServedMealEntry[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const stored = await getServedMeals();
    setEntries(stored);
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

  return {
    entries,
    isLoading,
    refresh: load,
    logServedMeal,
  };
};

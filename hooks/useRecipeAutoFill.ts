import { useFamilyMembers } from "./useFamilyMembers";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  autoFillMealFromUrl,
  RecipeAutoFillOutcome,
  RecipeAutoFillResult,
} from "../utils/recipeAutoFill";

type AutoFillState = {
  isLoading: boolean;
  error: string | null;
  result: RecipeAutoFillResult | null;
};

const initialState: AutoFillState = {
  isLoading: false,
  error: null,
  result: null,
};

export const useRecipeAutoFill = (
  url: string | undefined,
  existingMealTitle?: string,
) => {
  const { members } = useFamilyMembers();
  const householdSize = members.length || 4;
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  const [state, setState] = useState<AutoFillState>(initialState);

  const requestAutoFill = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!url || url.trim().length === 0) {
      setState((prev) => ({
        ...prev,
        error: "Add a recipe link before trying auto-fill.",
      }));
      return {
        ok: false as const,
        error: "Add a recipe link before trying auto-fill.",
      } satisfies RecipeAutoFillOutcome;
    }

    setState({ isLoading: true, error: null, result: null });

    const outcome = await autoFillMealFromUrl(url, existingMealTitle, householdSize);

    if (version !== requestVersion.current) return outcome;

    if (outcome.ok) {
      setState({ isLoading: false, error: null, result: outcome.data });
    } else {
      setState({ isLoading: false, error: outcome.error, result: null });
    }

    return outcome;
  }, [existingMealTitle, url, householdSize]);

  const resetAutoFill = useCallback(() => {
    requestVersion.current += 1;
    setState(initialState);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    requestAutoFill,
    resetAutoFill,
    clearError,
  };
};

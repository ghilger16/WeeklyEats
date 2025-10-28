import { useCallback, useState } from "react";
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

export const useRecipeAutoFill = (url: string | undefined) => {
  const [state, setState] = useState<AutoFillState>(initialState);

  const requestAutoFill = useCallback(async () => {
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

    const outcome = await autoFillMealFromUrl(url);

    if (outcome.ok) {
      setState({ isLoading: false, error: null, result: outcome.data });
    } else {
      setState({ isLoading: false, error: outcome.error, result: null });
    }

    return outcome;
  }, [url]);

  const resetAutoFill = useCallback(() => {
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

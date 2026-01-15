export type RecipeAutoFillResult = {
  title?: string;
  ingredients?: string[];
  difficulty?: number;
  expense?: number;
  prepNotes?: string;
  summary?: string;
};

export type RecipeAutoFillOutcome =
  | {
      ok: true;
      data: RecipeAutoFillResult;
    }
  | {
      ok: false;
      error: string;
    };

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(value), min), max);

const buildFunctionUrl = () => {
  if (!API_BASE_URL) {
    return null;
  }
  return `${API_BASE_URL.replace(/\/+$/, "")}/.netlify/functions/recipeAutoFill`;
};

export const autoFillMealFromUrl = async (
  rawUrl: string
): Promise<RecipeAutoFillOutcome> => {
  if (!API_BASE_URL) {
    return {
      ok: false,
      error: "Auto-fill is not configured yet. Add EXPO_PUBLIC_API_BASE_URL.",
    };
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch (error) {
    return {
      ok: false,
      error: "That link doesn\u2019t look right. Check the URL and try again.",
    };
  }

  const functionUrl = buildFunctionUrl();
  if (!functionUrl) {
    return {
      ok: false,
      error: "Auto-fill is not configured yet. Add EXPO_PUBLIC_API_BASE_URL.",
    };
  }

  let response: Response;

  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url.toString() }),
    });
  } catch (error) {
    return {
      ok: false,
      error: "We couldn\u2019t reach the auto-fill service. Try again later.",
    };
  }

  if (!response.ok) {
    try {
      const payload = (await response.json()) as RecipeAutoFillOutcome;
      return {
        ok: false,
        error: payload?.error ?? "Auto-fill failed. Check the link and try again.",
      };
    } catch (error) {
      return {
        ok: false,
        error: "Auto-fill failed. Check the link and try again.",
      };
    }
  }

  try {
    const payload = (await response.json()) as RecipeAutoFillOutcome;
    if (payload && payload.ok) {
      return {
        ok: true,
        data: {
          title: payload.data.title?.trim(),
          ingredients: payload.data.ingredients,
          difficulty:
            typeof payload.data.difficulty === "number"
              ? clamp(payload.data.difficulty, 1, 5)
              : undefined,
          expense:
            typeof payload.data.expense === "number"
              ? clamp(payload.data.expense, 1, 5)
              : undefined,
          prepNotes: payload.data.prepNotes?.trim(),
          summary: payload.data.summary?.trim(),
        },
      };
    }

    return {
      ok: false,
      error: payload?.error ?? "Auto-fill failed. Try again later.",
    };
  } catch (error) {
    return {
      ok: false,
      error: "Auto-fill failed. Try again later.",
    };
  }
};

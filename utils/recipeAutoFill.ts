export type RecipeAutoFillResult = {
  title?: string;
  ingredients?: string[];
  difficulty?: number;
  expense?: number;
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampSliderValue = (value: number) => clamp(Math.round(value), 1, 5);

const normalizeSegment = (segment: string) =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractTitleFromUrl = (url: URL) => {
  const parts = url.pathname
    .split("/")
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts[parts.length - 1];
};

type JsonLdNode = Record<string, unknown> | Array<unknown>;

const findRecipeNode = (node: JsonLdNode): Record<string, unknown> | undefined => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const candidate = findRecipeNode(item as JsonLdNode);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  }

  if (typeof node !== "object" || node === null) {
    return undefined;
  }

  const typeValue = node["@type"];
  const matchesRecipe = (() => {
    if (Array.isArray(typeValue)) {
      return typeValue.some((type) =>
        typeof type === "string" && type.toLowerCase() === "recipe"
      );
    }
    if (typeof typeValue === "string") {
      return typeValue.toLowerCase() === "recipe";
    }
    return false;
  })();

  if (matchesRecipe) {
    return node as Record<string, unknown>;
  }

  for (const value of Object.values(node)) {
    const candidate = findRecipeNode(value as JsonLdNode);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
};

const extractJsonLdRecipe = (html: string): Record<string, unknown> | undefined => {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html))) {
    const rawJson = match[1]
      .replace(/<!--.*?-->/gs, "")
      .trim();

    if (!rawJson) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawJson);
      const recipeNode = findRecipeNode(parsed);
      if (recipeNode) {
        return recipeNode;
      }
    } catch (error) {
      // silently skip malformed snippets
      continue;
    }
  }

  return undefined;
};

const flattenStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const result = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return result.length > 0 ? result : undefined;
  }

  if (typeof value === "string") {
    const candidates = value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return candidates.length > 0 ? candidates : undefined;
  }

  return undefined;
};

const deriveDifficulty = (
  source: Record<string, unknown>
): number | undefined => {
  const difficultyHints = [
    source["recipeCategory"],
    source["keywords"],
    source["description"],
  ]
    .flat()
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .join(" ");

  if (!difficultyHints) {
    return undefined;
  }

  if (/\b(beginner|easy|simple|quick|no[-\s]?cook)\b/.test(difficultyHints)) {
    return 1;
  }

  if (/\b(intermediate|moderate|everyday|weeknight)\b/.test(difficultyHints)) {
    return 3;
  }

  if (/\b(advanced|difficult|hard|gourmet|expert)\b/.test(difficultyHints)) {
    return 5;
  }

  return undefined;
};

const deriveExpense = (source: Record<string, unknown>): number | undefined => {
  const expenseHints = [source["keywords"], source["description"], source["recipeCategory"]]
    .flat()
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .join(" ");

  if (!expenseHints) {
    return undefined;
  }

  if (/\b(budget|cheap|affordable|thrifty|weeknight)\b/.test(expenseHints)) {
    return 1;
  }

  if (/\b(premium|splurge|indulgent|fancy|luxury|holiday)\b/.test(expenseHints)) {
    return 5;
  }

  return undefined;
};

const fallbackIngredientsFromHtml = (html: string): string[] | undefined => {
  const lowerHtml = html.toLowerCase();
  const ingredientsSectionMatch = lowerHtml.match(
    /<[^>]*id=["']ingredients?["'][^>]*>([\s\S]*?)<\//
  );

  const targetHtml = ingredientsSectionMatch ? ingredientsSectionMatch[1] : html;

  const listRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const ingredients = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = listRegex.exec(targetHtml))) {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length >= 3 && text.length <= 140) {
      ingredients.add(text);
    }
  }

  if (ingredients.size === 0) {
    return undefined;
  }

  return Array.from(ingredients).slice(0, 12);
};

const sanitizeSummary = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.replace(/\s+/g, " ").trim();
};

const buildResultFromRecipeNode = (
  recipeNode: Record<string, unknown>,
  html: string,
  fallbackTitle?: string
): RecipeAutoFillResult => {
  const title = typeof recipeNode["name"] === "string" ? recipeNode["name"].trim() : fallbackTitle;
  const summary =
    sanitizeSummary(recipeNode["description"]) ??
    sanitizeSummary(recipeNode["summary"]);

  const parsedIngredients =
    flattenStringArray(recipeNode["recipeIngredient"]) ??
    flattenStringArray(recipeNode["ingredients"]) ??
    fallbackIngredientsFromHtml(html);

  const derivedDifficulty = deriveDifficulty(recipeNode);
  const difficulty =
    typeof derivedDifficulty === "number"
      ? clampSliderValue(derivedDifficulty)
      : undefined;

  const derivedExpense = deriveExpense(recipeNode);
  const expense =
    typeof derivedExpense === "number"
      ? clampSliderValue(derivedExpense)
      : undefined;

  return {
    title,
    ingredients: parsedIngredients,
    difficulty,
    expense,
    summary,
  };
};

const fetchRecipeHtml = async (url: URL): Promise<string> => {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
};

export const autoFillMealFromUrl = async (
  rawUrl: string
): Promise<RecipeAutoFillOutcome> => {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch (error) {
    return {
      ok: false,
      error: "That link doesn\u2019t look right. Check the URL and try again.",
    };
  }

  let html: string;

  try {
    html = await fetchRecipeHtml(url);
  } catch (error) {
    return {
      ok: false,
      error: "We couldn\u2019t reach that recipe. Check your connection and try again.",
    };
  }

  const recipeNode = extractJsonLdRecipe(html);

  if (recipeNode) {
    const result = buildResultFromRecipeNode(recipeNode, html, extractTitleFromUrl(url));
    return { ok: true, data: result };
  }

  const fallbackTitle = extractTitleFromUrl(url);
  const fallbackIngredients = fallbackIngredientsFromHtml(html);

  if (!fallbackTitle && !fallbackIngredients) {
    return {
      ok: false,
      error: "We couldn\u2019t extract details from that recipe link yet.",
    };
  }

  return {
    ok: true,
    data: {
      title: fallbackTitle,
      ingredients: fallbackIngredients,
      difficulty: undefined,
      expense: undefined,
    },
  };
};

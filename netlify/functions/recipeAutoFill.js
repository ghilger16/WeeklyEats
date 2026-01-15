const OPENAI_MODEL = "gpt-4o-mini";
const MAX_HTML_CHARS = 12000;
const MAX_INGREDIENTS = 12;

const stripHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractTitleFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname
      .split("/")
      .map((segment) =>
        segment
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      )
      .filter(Boolean);
    return parts[parts.length - 1];
  } catch (error) {
    return undefined;
  }
};

const clamp = (value, min, max) =>
  Math.min(Math.max(Math.round(value), min), max);

const cleanIngredient = (ingredient) => {
  if (!ingredient || typeof ingredient !== "string") {
    return "";
  }

  const withoutParens = ingredient.replace(/\([^)]*\)/g, " ");
  const normalized = withoutParens.replace(/\s+/g, " ").trim();

  const measurementPattern =
    /^(\d+(?:\s?\d+\/\d+)?|\d+\/\d+|\d+\.\d+)?\s*(cups?|cup|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|pinch|dash|cloves?|slices?|cans?|packages?|pkg|sticks?|pieces?|bunch(?:es)?|handful|heads?|bulbs?)\b/i;

  const trimmed = normalized.replace(measurementPattern, "").trim();
  const withoutOf = trimmed.replace(/^of\s+/i, "").trim();
  const cleaned = withoutOf.replace(/^[\-\*\s]+/, "").trim();

  return cleaned || normalized;
};

const buildOpenAiPayload = (url, text) => ({
  model: OPENAI_MODEL,
  temperature: 0.2,
  max_tokens: 600,
  response_format: { type: "json_object" },
  messages: [
    {
      role: "system",
      content:
        "You extract recipe details for a meal card. Return only JSON.",
    },
    {
      role: "user",
      content: [
        "Return a JSON object with keys: title, ingredients, difficulty, expense, prepNotes.",
        "Ingredients must be names only: no quantities, no units, no prep notes.",
        "Difficulty and expense are integers 1-5. PrepNotes is short.",
        `Recipe URL: ${url}`,
        `Recipe text: ${text}`,
      ].join("\n"),
    },
  ],
});

const parseOpenAiContent = (data) => {
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Missing OPENAI_API_KEY.",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: "Invalid request body." }),
    };
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: "Missing recipe URL." }),
    };
  }

  let html;
  try {
    const recipeResponse = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "WeeklyEatsBot/1.0",
      },
    });
    if (!recipeResponse.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: "Could not fetch recipe URL.",
        }),
      };
    }
    html = await recipeResponse.text();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        ok: false,
        error: "Could not fetch recipe URL.",
      }),
    };
  }

  const trimmedText = stripHtml(html).slice(0, MAX_HTML_CHARS);

  let aiResponse;
  try {
    aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOpenAiPayload(url, trimmedText)),
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Auto-fill failed.",
      }),
    };
  }

  if (!aiResponse.ok) {
    let errorMessage = "Auto-fill failed.";
    try {
      const errorPayload = await aiResponse.json();
      if (errorPayload?.error?.message) {
        errorMessage = errorPayload.error.message;
      }
    } catch (error) {
      // ignore parse failures
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
    };
  }

  let parsed;
  try {
    const data = await aiResponse.json();
    parsed = parseOpenAiContent(data);
  } catch (error) {
    parsed = null;
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Auto-fill failed to parse model response.",
      }),
    };
  }

  const title =
    typeof parsed.title === "string" && parsed.title.trim().length > 0
      ? parsed.title.trim()
      : extractTitleFromUrl(url);

  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients
        .map((item) => cleanIngredient(item))
        .filter(Boolean)
        .slice(0, MAX_INGREDIENTS)
    : [];

  const difficulty =
    typeof parsed.difficulty === "number"
      ? clamp(parsed.difficulty, 1, 5)
      : 3;
  const expense =
    typeof parsed.expense === "number" ? clamp(parsed.expense, 1, 5) : 3;
  const prepNotes =
    typeof parsed.prepNotes === "string" ? parsed.prepNotes.trim() : "";

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      data: {
        title,
        ingredients,
        difficulty,
        expense,
        prepNotes,
      },
    }),
  };
};

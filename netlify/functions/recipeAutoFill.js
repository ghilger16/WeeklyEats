const OPENAI_MODEL = "gpt-4o-mini";
const MAX_HTML_CHARS = 12000;

const SHOPPING_CATEGORIES = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "deli",
  "frozen",
  "pantry",
  "canned",
  "pastaAndRice",
  "spices",
  "condiments",
  "baking",
  "beverages",
  "snacks",
  "household",
  "other",
];

const CATEGORY_ORDER = {
  meat: 1,
  seafood: 2,
  pastaAndRice: 3,
  produce: 4,
  dairy: 5,
  canned: 6,
  pantry: 7,
  condiments: 8,
  bakery: 9,
  deli: 10,
  frozen: 11,
  baking: 12,
  beverages: 13,
  snacks: 14,
  household: 15,
  other: 16,
  spices: 99,
};

const INGREDIENT_TYPE_ORDER = {
  keyIngredient: 1,
  pantryStaple: 2,
};

const SPICE_WORDS = [
  "salt",
  "pepper",
  "paprika",
  "cumin",
  "coriander",
  "turmeric",
  "garam masala",
  "oregano",
  "thyme",
  "basil",
  "parsley",
  "rosemary",
  "chili powder",
  "chilli powder",
  "garlic powder",
  "onion powder",
  "red pepper flakes",
  "crushed red pepper",
  "seasoning",
  "cinnamon",
  "nutmeg",
  "cayenne",
  "cardamom",
  "cloves",
  "bay leaves",
];

const PANTRY_STAPLE_WORDS = [
  "olive oil",
  "extra virgin olive oil",
  "vegetable oil",
  "canola oil",
  "avocado oil",
  "cooking oil",
  "cooking spray",
  "white vinegar",
  "apple cider vinegar",
  "red wine vinegar",
  "white wine vinegar",
  "sherry vinegar",
  "rice vinegar",
  "balsamic vinegar",
  "salt",
  "sea salt",
  "kosher salt",
  "black pepper",
  "ground pepper",
  "paprika",
  "cumin",
  "ground coriander",
  "turmeric",
  "garam masala",
  "oregano",
  "dried thyme",
  "dried basil",
  "dried parsley",
  "dried rosemary",
  "chili powder",
  "chilli powder",
  "garlic powder",
  "onion powder",
  "red pepper flakes",
  "crushed red pepper",
  "cinnamon",
  "nutmeg",
  "cayenne",
  "cardamom",
  "cloves",
  "bay leaf",
  "bay leaves",
];

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
          .replace(/\b\w/g, (char) => char.toUpperCase()),
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

const normalizeCategory = (category) => {
  if (typeof category === "string" && SHOPPING_CATEGORIES.includes(category)) {
    return category;
  }

  return "other";
};

const normalizeIngredientType = (value) =>
  value === "pantryStaple" ? "pantryStaple" : "keyIngredient";

const normalizeIngredient = (item) => {
  if (typeof item === "string") {
    const name = cleanIngredient(item);
    if (!name) return null;

    return {
      name,
      category: "other",
      ingredientType: "keyIngredient",
    };
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const name = cleanIngredient(item.name);
  if (!name) return null;

  return {
    name,
    category: normalizeCategory(item.category),
    ingredientType: normalizeIngredientType(item.ingredientType),
  };
};

const isSpiceOrSeasoning = (ingredient) => {
  const value = ingredient.name.toLowerCase();

  if (ingredient.category === "spices") {
    return true;
  }

  if (ingredient.category === "produce") {
    return false;
  }

  return SPICE_WORDS.some((word) => value.includes(word));
};

const isLikelyPantryStaple = (ingredient) => {
  const value = ingredient.name.toLowerCase();

  if (ingredient.category === "spices") {
    return true;
  }

  if (ingredient.category === "produce") {
    return false;
  }

  return PANTRY_STAPLE_WORDS.some(
    (word) => value === word || value.includes(word),
  );
};

const normalizeIngredientGrouping = (ingredient) => ({
  ...ingredient,
  ingredientType:
    ingredient.ingredientType === "pantryStaple" ||
    isLikelyPantryStaple(ingredient)
      ? "pantryStaple"
      : "keyIngredient",
});

const sortIngredientsForShopping = (ingredients) =>
  ingredients
    .map((ingredient) =>
      isSpiceOrSeasoning(ingredient)
        ? { ...ingredient, category: "spices" }
        : ingredient,
    )
    .map(normalizeIngredientGrouping)
    .sort((a, b) => {
      const aTypeOrder =
        INGREDIENT_TYPE_ORDER[a.ingredientType] ??
        INGREDIENT_TYPE_ORDER.keyIngredient;
      const bTypeOrder =
        INGREDIENT_TYPE_ORDER[b.ingredientType] ??
        INGREDIENT_TYPE_ORDER.keyIngredient;

      if (aTypeOrder !== bTypeOrder) {
        return aTypeOrder - bTypeOrder;
      }

      const aOrder = CATEGORY_ORDER[a.category] ?? CATEGORY_ORDER.other;
      const bOrder = CATEGORY_ORDER[b.category] ?? CATEGORY_ORDER.other;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return a.name.localeCompare(b.name);
    });

const buildOpenAiPayload = (url, text) => ({
  model: OPENAI_MODEL,
  temperature: 0.2,
  max_tokens: 1400,
  response_format: { type: "json_object" },
  messages: [
    {
      role: "system",
      content: "You extract recipe details for a meal card. Return only JSON.",
    },
    {
      role: "user",
      content: [
        "Return a JSON object with keys: title, ingredients, difficulty, expense, prepNotes.",

        "For title, invent the short meal name a family would say at dinner. Do not copy the recipe page title.",
        "Title should usually be 2-4 words and under 28 characters.",
        "Title must remove marketing, timing, ingredient-count, and cookware/method words.",
        "Do not include these words in title unless they are essential to the dish identity: Easy, Simple, Best, Quick, Healthy, Homemade, Creamy, Sheet Pan, One Pot, One-Pot, One Pan, One Skillet, One-Skillet, Skillet, 15-Minute, 30-Minute, 3-Ingredient.",
        "Keep the recognizable food identity: Chicken, Pasta, Tacos, Chili, Stir Fry, Casserole, Fajitas, Soup, Curry, Alfredo.",
        "If the recipe is 'Simple One Skillet Chicken Alfredo Pasta' or the URL contains 'simple-one-skillet-chicken-alfredo-pasta', title must be 'Chicken Alfredo Pasta'.",
        "More title examples: 'Creamy White Chicken Chili' -> 'White Chicken Chili'; 'Good Old Fashioned Pancakes' -> 'Pancakes'; 'Easy Sheet Pan Chicken Fajitas' -> 'Chicken Fajitas'.",

        "Ingredients must be returned as objects with this shape: { name: string, category: string, ingredientType: string }.",
        "Ingredient names must be names only: no quantities, no units, no prep notes.",
        "Return all ingredients required to make the recipe itself.",
        "Include ingredients from cooking sections like Marinade, Sauce, Curry, Filling, Topping, Dressing, and Main.",
        "Do not omit small required ingredients like salt, pepper, spices, dried herbs, oils, garlic, ginger, aromatics, sauces, or optional-but-listed cooking ingredients.",
        "Only omit water if it is clearly just used for cooking or thinning.",
        "Do not combine ingredients. Each listed recipe ingredient should become its own ingredient object.",
        "Do not summarize multiple spices into a generic ingredient like seasoning.",

        "Exclude all serving suggestions.",
        "Exclude ingredients under sections named To Serve, For Serving, Serving Suggestions, Optional Garnish, Garnish, Optional, Recommended Sides, Suggested Accompaniments, or similar.",
        "Exclude side dishes, accompaniments, and recommended serving items.",
        "If a recipe says choose one, choose, serve with, or to serve, do not include those items.",
        "Do not include rice, bread, tortillas, salad, herbs, or garnishes when they are only listed as serving suggestions.",
        "Only return ingredients used during preparation or cooking of the recipe.",
        "Do not attempt to sort or prioritize ingredients. The app will sort them later.",

        "Category must be one of these exact values only:",
        SHOPPING_CATEGORIES.join(", "),

        "ingredientType must be exactly one of these values only: keyIngredient, pantryStaple.",
        "Use keyIngredient for the primary foods, proteins, produce, dairy, grains, canned goods, sauces, and other ingredients that define the meal or are reasonably likely to require shopping.",
        "Use pantryStaple only for ingredients that many households commonly keep available, especially cooking oils, basic vinegars, salt, pepper, dried herbs, dried spices, seasoning powders, and cooking spray.",
        "Classify fresh herbs such as fresh cilantro, parsley, basil, rosemary, and thyme as keyIngredient, not pantryStaple.",
        "Classify fresh garlic, fresh ginger, onions, lemons, and limes as keyIngredient.",
        "Do not classify an ingredient as pantryStaple merely because its grocery category is pantry, condiments, or baking.",
        "When uncertain, use keyIngredient.",

        "Choose the grocery-store location category where the shopper would most likely find the item.",
        "Use produce for fresh fruits, vegetables, garlic, onions, fresh herbs, lemons, and limes.",
        "Use meat for chicken, beef, pork, sausage, bacon, turkey, and other butcher-section proteins.",
        "Use seafood for fish, shrimp, scallops, crab, and other seafood.",
        "Use dairy for milk, cheese, cream, sour cream, yogurt, butter, eggs, and ghee.",
        "Use bakery for bread, buns, rolls, bagels, tortillas from the bakery area, and fresh baked goods.",
        "Use deli for deli meats, prepared salads, rotisserie chicken, specialty cheeses, and prepared deli items.",
        "Use frozen for frozen vegetables, frozen fruit, frozen meals, frozen dough, and frozen prepared ingredients.",
        "Use pantry for oils, vinegar, broth, shelf-stable sauces, dry goods, flour tortillas, breadcrumbs, and general pantry items.",
        "Use canned for canned tomatoes, tomato passata, beans, corn, soup, coconut milk, and other canned or jarred meal staples.",
        "Use pastaAndRice for pasta, rice, noodles, couscous, quinoa, and grains.",
        "Use spices for salt, pepper, dried herbs, seasoning blends, flakes, powders, garam masala, cumin, turmeric, paprika, and small spice-jar ingredients.",
        "Use condiments for ketchup, mustard, mayo, BBQ sauce, hot sauce, salsa, dressing, soy sauce, Worcestershire sauce, and similar bottled sauces.",
        "Use baking for flour, sugar, baking powder, baking soda, chocolate chips, cocoa powder, and baking-specific ingredients.",
        "Use beverages for drinks, juice, coffee, tea, and drink mixes.",
        "Use snacks for chips, crackers, pretzels, popcorn, and snack foods.",
        "Use household for non-food grocery items.",
        "Use other only when no category clearly fits.",

        "PrepNotes should only include advance-ahead tasks, like defrosting or marinating. Keep it short.",
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
    ? sortIngredientsForShopping(
        parsed.ingredients.map(normalizeIngredient).filter(Boolean),
      )
    : [];

  const difficulty =
    typeof parsed.difficulty === "number" ? clamp(parsed.difficulty, 1, 5) : 3;

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

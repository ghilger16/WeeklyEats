export type MealTitleMatch = {
  matches: boolean;
  confidence: number;
};

const IGNORED_WORDS = new Set([
  "a", "an", "and", "best", "classic", "creamy", "easy", "fresh",
  "healthy", "home", "homemade", "old", "one", "quick", "recipe",
  "simple", "style", "the", "with",
]);

const DISH_WORDS = new Set([
  "alfredo", "burger", "burrito", "casserole", "chili", "chowder",
  "curry", "enchilada", "fajita", "lasagna", "meatball", "meatloaf",
  "noodle", "pancake", "pasta", "pizza", "ramen", "risotto", "salad",
  "sandwich", "soup", "spaghetti", "stew", "stirfry", "taco",
  "tamale", "waffle",
]);

const singularize = (word: string) => {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
};

const titleTokens = (title: string) =>
  title
    .toLocaleLowerCase()
    .replace(/stir[\s-]?fry/g, "stirfry")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .map(singularize)
    .filter((word) => word && !IGNORED_WORDS.has(word));

export const compareMealTitles = (
  existingTitle: string,
  detectedTitle: string,
): MealTitleMatch | null => {
  const existingTokens = new Set(titleTokens(existingTitle));
  const detectedTokens = new Set(titleTokens(detectedTitle));
  if (!existingTokens.size || !detectedTokens.size) return null;

  if ([...existingTokens].some((token) => detectedTokens.has(token))) {
    return { matches: true, confidence: 0.9 };
  }

  const existingDishes = [...existingTokens].filter((token) => DISH_WORDS.has(token));
  const detectedDishes = [...detectedTokens].filter((token) => DISH_WORDS.has(token));
  if (existingDishes.length > 0 && detectedDishes.length > 0) {
    return { matches: false, confidence: 0.86 };
  }

  return null;
};

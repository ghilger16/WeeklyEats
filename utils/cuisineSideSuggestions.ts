import { CuisineType } from "../types/cuisine";

export const CUISINE_SIDE_SUGGESTIONS: Record<CuisineType, readonly string[]> = {
  american: ["Mashed Potatoes", "Green Beans", "Mac & Cheese", "Coleslaw", "Dinner Rolls", "Corn on the Cob"],
  bbq: ["Mac & Cheese", "Baked Beans", "Corn", "Coleslaw", "Potato Salad", "Cornbread"],
  cajunCreole: ["White Rice", "Cornbread", "Red Beans", "Coleslaw", "Corn", "Green Beans"],
  caribbean: ["Rice & Beans", "Plantains", "White Rice", "Corn", "Coleslaw", "Side Salad"],
  chinese: ["White Rice", "Fried Rice", "Broccoli", "Egg Rolls", "Green Beans", "Mixed Vegetables"],
  french: ["French Bread", "Side Salad", "Green Beans", "Roasted Potatoes", "Mashed Potatoes", "Roasted Vegetables"],
  greek: ["Greek Salad", "Pita Bread", "Rice", "Roasted Potatoes", "Green Beans", "Roasted Vegetables"],
  indian: ["Basmati Rice", "Naan", "Roasted Vegetables", "Cucumber Salad", "Lentils", "Green Beans"],
  italian: ["Garlic Bread", "Side Salad", "Broccoli", "Green Beans", "Roasted Vegetables", "Pasta"],
  japanese: ["White Rice", "Edamame", "Broccoli", "Cucumber Salad", "Mixed Vegetables", "Noodles"],
  korean: ["White Rice", "Kimchi", "Cucumber Salad", "Broccoli", "Green Beans", "Mixed Vegetables"],
  mediterranean: ["Pita Bread", "Side Salad", "Rice", "Hummus", "Roasted Vegetables", "Cucumber Salad"],
  mexican: ["Spanish Rice", "Refried Beans", "Corn", "Chips & Salsa", "Guacamole", "Side Salad"],
  middleEastern: ["Pita Bread", "Rice", "Hummus", "Cucumber Salad", "Roasted Vegetables", "Side Salad"],
  southern: ["Mac & Cheese", "Green Beans", "Cornbread", "Collard Greens", "Mashed Potatoes", "Corn"],
  spanish: ["Rice", "Roasted Potatoes", "Side Salad", "Bread", "Green Beans", "Roasted Vegetables"],
  texMex: ["Spanish Rice", "Black Beans", "Corn", "Chips & Salsa", "Guacamole", "Refried Beans"],
  thai: ["Jasmine Rice", "Cucumber Salad", "Spring Rolls", "Broccoli", "Green Beans", "Mixed Vegetables"],
  vietnamese: ["Jasmine Rice", "Spring Rolls", "Cucumber Salad", "Noodles", "Mixed Vegetables", "Broccoli"],
  other: ["Side Salad", "Green Beans", "Broccoli", "Corn", "Rice", "Roasted Potatoes"],
};

export const GENERIC_SIDE_SUGGESTIONS = [
  "Side Salad",
  "Green Beans",
  "Broccoli",
  "Corn",
  "Rice",
  "Roasted Potatoes",
  "Mixed Vegetables",
  "Fruit",
] as const;

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export type CuisineSideOverrides = Partial<Record<CuisineType, readonly string[]>>;

export const getCuisineSides = (cuisine: CuisineType, overrides: CuisineSideOverrides = {}) =>
  overrides[cuisine] ?? CUISINE_SIDE_SUGGESTIONS[cuisine];

type SideSuggestionOptions = {
  cuisine?: CuisineType | null;
  savedSides?: string[];
  cuisineOverrides?: CuisineSideOverrides;
};

export const getSideSuggestions = ({
  cuisine,
  savedSides = [],
  cuisineOverrides = {},
}: SideSuggestionOptions): string[] => {
  const savedKeys = new Set(savedSides.map(normalize));
  const source = cuisine
    ? getCuisineSides(cuisine, cuisineOverrides)
    : GENERIC_SIDE_SUGGESTIONS;

  return source
    .filter((side) => !savedKeys.has(normalize(side)))
    .slice(0, 6);
};

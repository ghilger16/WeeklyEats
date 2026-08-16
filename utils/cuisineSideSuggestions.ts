import { CuisineType } from "../types/cuisine";

export const CUISINE_SIDE_SUGGESTIONS: Record<CuisineType, readonly string[]> = {
  american: ["French Fries", "Tater Tots", "Mac & Cheese", "Corn", "Green Beans", "Side Salad", "Roasted Potatoes", "Fruit"],
  bbq: ["Mac & Cheese", "Baked Beans", "Corn", "Coleslaw", "Potato Salad", "Cornbread", "Green Beans", "French Fries"],
  cajunCreole: ["White Rice", "Cornbread", "Red Beans", "Coleslaw", "Corn", "Green Beans", "Side Salad", "French Bread"],
  caribbean: ["Rice & Beans", "Plantains", "White Rice", "Corn", "Coleslaw", "Side Salad", "Roasted Vegetables", "Fruit"],
  chinese: ["White Rice", "Fried Rice", "Broccoli", "Egg Rolls", "Green Beans", "Mixed Vegetables", "Noodles", "Cucumber Salad"],
  french: ["French Bread", "Side Salad", "Green Beans", "Roasted Potatoes", "Mashed Potatoes", "Roasted Vegetables", "Broccoli", "Carrots"],
  greek: ["Greek Salad", "Pita Bread", "Rice", "Roasted Potatoes", "Green Beans", "Roasted Vegetables", "Cucumber Salad", "Hummus"],
  indian: ["Basmati Rice", "Naan", "Roasted Vegetables", "Cucumber Salad", "Lentils", "Green Beans", "Potatoes", "Side Salad"],
  italian: ["Garlic Bread", "Side Salad", "Broccoli", "Green Beans", "Roasted Vegetables", "Pasta", "Roasted Potatoes", "Breadsticks"],
  japanese: ["White Rice", "Edamame", "Broccoli", "Cucumber Salad", "Mixed Vegetables", "Noodles", "Green Beans", "Side Salad"],
  korean: ["White Rice", "Kimchi", "Cucumber Salad", "Broccoli", "Green Beans", "Mixed Vegetables", "Noodles", "Side Salad"],
  mediterranean: ["Pita Bread", "Side Salad", "Rice", "Hummus", "Roasted Vegetables", "Cucumber Salad", "Roasted Potatoes", "Green Beans"],
  mexican: ["Spanish Rice", "Refried Beans", "Corn", "Chips & Salsa", "Guacamole", "Side Salad", "Black Beans", "Fruit"],
  middleEastern: ["Pita Bread", "Rice", "Hummus", "Cucumber Salad", "Roasted Vegetables", "Side Salad", "Lentils", "Roasted Potatoes"],
  southern: ["Mac & Cheese", "Green Beans", "Cornbread", "Collard Greens", "Mashed Potatoes", "Corn", "Coleslaw", "Baked Beans"],
  spanish: ["Rice", "Roasted Potatoes", "Side Salad", "Bread", "Green Beans", "Roasted Vegetables", "Olives", "Tomato Salad"],
  texMex: ["Spanish Rice", "Black Beans", "Corn", "Chips & Salsa", "Guacamole", "Refried Beans", "Side Salad", "Queso"],
  thai: ["Jasmine Rice", "Cucumber Salad", "Spring Rolls", "Broccoli", "Green Beans", "Mixed Vegetables", "Noodles", "Side Salad"],
  vietnamese: ["Jasmine Rice", "Spring Rolls", "Cucumber Salad", "Noodles", "Mixed Vegetables", "Broccoli", "Green Beans", "Side Salad"],
  other: ["Side Salad", "Green Beans", "Broccoli", "Corn", "Rice", "Roasted Potatoes", "Mixed Vegetables", "Fruit"],
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

const normalize = (value: string) => value.trim().toLocaleLowerCase();

type SideSuggestionOptions = {
  cuisine?: CuisineType | null;
  savedSides?: string[];
};

export const getSideSuggestions = ({
  cuisine,
  savedSides = [],
}: SideSuggestionOptions): string[] => {
  const savedKeys = new Set(savedSides.map(normalize));
  const source = cuisine
    ? CUISINE_SIDE_SUGGESTIONS[cuisine]
    : GENERIC_SIDE_SUGGESTIONS;

  return source
    .filter((side) => !savedKeys.has(normalize(side)))
    .slice(0, 6);
};

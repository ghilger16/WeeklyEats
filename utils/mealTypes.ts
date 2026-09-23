import { Meal } from "../types/meals";
import { MealTypeOption } from "../types/dayPins";

// Meals do not store type tags. Match recognizable title words, never cuisine.
const patterns: Record<MealTypeOption, RegExp> = {
  pasta: /\b(pasta|spaghetti|lasagn[ae]|penne|rigatoni|fettuccine|linguine|macaroni|ravioli|tortellini|orzo|gnocchi)\b/i,
  soup: /\b(soups?|stews?|chowders?|bisques?)\b/i,
  tacos: /\btacos?\b/i,
  salad: /\bsalads?\b/i,
  one_pot: /\bone[\s-]+(pot|pan)\b/i,
};

export const matchesMealType = (meal: Meal, type: MealTypeOption) =>
  patterns[type].test(meal.title);

import { ServedMealEntry } from "../../../stores/servedMealsStorage";
import { getLatestServedDates, getDaysSinceServed, getRepeatTimingScore } from "../../../utils/servingHistory";
import { getFamilyRatingScore } from "../../../utils/familyRatings";
import { matchesMealType } from "../../../utils/mealTypes";
import { Meal } from "../../../types/meals";
import { DayPinsState, EffortOption } from "../../../types/dayPins";
import { SuggestionBannerContext } from "./suggestionBanners";
import { hasFullFreezerMeal } from "../../../utils/freezerMealAmount";

type DifficultyKey = "easy" | "medium" | "hard";

const difficultyFromValue = (value?: number): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) {
    return "easy";
  }
  if (value >= 4) {
    return "hard";
  }
  return "medium";
};

const effortToDifficultySet = (effort: EffortOption | null | undefined) => {
  if (!effort) {
    return null;
  }
  if (effort === "easy_medium") {
    return new Set<DifficultyKey>(["easy", "medium"]);
  }
  if (effort === "easy_medium_hard") {
    return new Set<DifficultyKey>(["easy", "medium", "hard"]);
  }
  if (effort === "medium_hard") {
    return new Set<DifficultyKey>(["medium", "hard"]);
  }
  return new Set<DifficultyKey>([effort]);
};

const hasFreezerInventory = (meal: Meal) => {
  return hasFullFreezerMeal(meal);
};

export const getExpenseTier = (meal: Meal): number => {
  if (typeof meal.expense === "number" && !Number.isNaN(meal.expense)) {
    return Math.max(1, Math.min(3, Math.round(meal.expense / 2)));
  }
  return meal.plannedCostTier ?? 1;
};

export type MealSuggestion = {
  meal: Meal;
  score: number;
  breakdown: { settings: number; rating: number; repeatTiming: number };
  context: SuggestionBannerContext;
};

const contextPriority: SuggestionBannerContext[] = [
  "freezer",
  "favorite",
  "reuse",
  "difficulty",
];

const resolveContextFromFlags = (flags: Set<SuggestionBannerContext>) => {
  for (const ctx of contextPriority) {
    if (flags.has(ctx)) {
      return ctx;
    }
  }
  return "general";
};

export const buildMealSuggestions = (
  meals: Meal[],
  pins: DayPinsState,
  excludeMealIds?: Set<Meal["id"]>,
  history: ServedMealEntry[] = [],
  now = Date.now(),
): MealSuggestion[] => {
  const latestServed = getLatestServedDates(history, now);
  const allowedDifficulty = effortToDifficultySet(pins.effort);
  const desiredExpense =
    pins.expense === "$"
      ? 1
      : pins.expense === "$$"
      ? 2
      : pins.expense === "$$$"
      ? 3
      : null;
  const shouldFilterByExpense = Boolean(desiredExpense && !pins.freezerNight);
  const shouldFilterByDifficulty = Boolean(
    allowedDifficulty && !pins.freezerNight
  );

  return meals
    .filter((meal) => {
      if (excludeMealIds?.has(meal.id)) {
        return false;
      }
      if (pins.excludedTypes?.some((type) => matchesMealType(meal, type))) return false;
      if (pins.familyStar === "exclude" && meal.isFavorite) {
        return false;
      }
      if (pins.freezerNight && !hasFreezerInventory(meal)) {
        return false;
      }
      if (shouldFilterByExpense) {
        const mealExpense = getExpenseTier(meal);
        if (desiredExpense !== null && mealExpense > desiredExpense) {
          return false;
        }
      }
      if (shouldFilterByDifficulty) {
        const mealDifficulty = difficultyFromValue(meal.difficulty);
        if (!allowedDifficulty?.has(mealDifficulty)) {
          return false;
        }
      }
      return true;
    })
    .map((meal) => {
      let score = 0;
      const flags = new Set<SuggestionBannerContext>();

      if (pins.freezerNight) {
        if (hasFreezerInventory(meal)) {
          score += 40;
          flags.add("freezer");
        } else {
          score -= 30;
        }
      } else if (hasFreezerInventory(meal)) {
        score += 5;
      }

      if (pins.familyStar === "include") {
        if (meal.isFavorite) {
          score += 30;
          flags.add("favorite");
        } else {
          score -= 25;
        }
      } else if (meal.isFavorite) {
        score += 5;
      }

      if (allowedDifficulty) {
        const mealDifficulty = difficultyFromValue(meal.difficulty);
        if (allowedDifficulty.has(mealDifficulty)) {
          score += 25;
          flags.add("difficulty");
        } else {
          score -= 15;
        }
      }

      const repeatTiming = getRepeatTimingScore(
        getDaysSinceServed(latestServed.get(meal.id), now), pins.reuseWeeks,
      );
      if (repeatTiming > 0) flags.add("reuse");

      if (pins.types?.some((type) => matchesMealType(meal, type))) score += 15;

      if (desiredExpense) {
        const mealExpense = getExpenseTier(meal);
        const diff = Math.abs(mealExpense - desiredExpense);
        if (diff === 0) {
          score += 10;
        } else if (diff === 1) {
          score += 3;
        } else {
          score -= 5;
        }
      }

      const rating = getFamilyRatingScore(meal);
      const breakdown = { settings: score, rating, repeatTiming };
      score += rating + repeatTiming;

      return {
        meal,
        score,
        breakdown,
        context: resolveContextFromFlags(flags),
      };
    })
    .sort((a, b) => b.score - a.score);
};

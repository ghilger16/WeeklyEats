import { Meal } from "../../../types/meals";
import { DayPinsState, EffortOption } from "../../../types/dayPins";
import { SuggestionBannerContext } from "./suggestionBanners";

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
  if (effort === "medium_hard") {
    return new Set<DifficultyKey>(["medium", "hard"]);
  }
  return new Set<DifficultyKey>([effort]);
};

const hasFreezerInventory = (meal: Meal) =>
  Boolean(meal.freezerAmount || meal.freezerQuantity);

const getExpenseTier = (meal: Meal): number => {
  if (typeof meal.expense === "number" && !Number.isNaN(meal.expense)) {
    return Math.max(1, Math.min(3, Math.round(meal.expense / 2)));
  }
  return meal.plannedCostTier ?? 1;
};

const getDaysSinceDate = (iso?: string): number | null => {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const diff = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export type MealSuggestion = {
  meal: Meal;
  score: number;
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
  pins: DayPinsState
): MealSuggestion[] => {
  const allowedDifficulty = effortToDifficultySet(pins.effort);
  const desiredExpense =
    pins.expense === "$"
      ? 1
      : pins.expense === "$$"
      ? 2
      : pins.expense === "$$$"
      ? 3
      : null;

  return meals
    .filter((meal) => {
      if (pins.familyStar === "exclude" && meal.isFavorite) {
        return false;
      }
      if (allowedDifficulty) {
        const mealDifficulty = difficultyFromValue(meal.difficulty);
        if (!allowedDifficulty.has(mealDifficulty)) {
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

      if (pins.reuseWeeks) {
        const daysSinceServed = getDaysSinceDate(meal.updatedAt);
        const threshold = pins.reuseWeeks * 7;
        if (daysSinceServed === null || daysSinceServed >= threshold) {
          score += 20;
          flags.add("reuse");
        } else {
          score -= 25;
        }
      }

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

      score += Math.min(meal.rating ?? 0, 5) * 2;

      return {
        meal,
        score,
        context: resolveContextFromFlags(flags),
      };
    })
    .sort((a, b) => b.score - a.score);
};

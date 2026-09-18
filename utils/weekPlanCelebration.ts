import { Meal } from "../types/meals";
import { CurrentPlannedWeek, PLANNED_WEEK_ORDER } from "../types/weekPlan";
import { isSpecialMealId, isFlexNightMealId } from "../types/specialMeals";
import type { ServedMealEntry } from "../stores/servedMealsStorage";
import { getBeenAwhileMeals, getEasyMeals, getBudgetMeals, isFamilyStarMeal, isFiveStarMeal } from "../components/plan-week/inspirationSelectors";
import { getRawFreezerMealAmount } from "./freezerMealAmount";
import { getIngredientOverlap, normalizeIngredientName } from "./ingredientOverlap";

export type WeekPlanCelebrationStat = {
  id: "dinners" | "favorites" | "beenAwhile" | "easy" | "freezer" | "flex" | "budget" | "shared" | "shopping";
  value: string;
  label: string;
};
export type WeekPlanCelebrationPayload = {
  dinnerCount: number;
  stats: WeekPlanCelebrationStat[];
  streakCount: number;
};

export const buildWeekPlanCelebration = ({ plan, meals, history = [], streakCount, ratingStyle = "family", now = Date.now() }: {
  plan: CurrentPlannedWeek;
  meals: Meal[];
  history?: ServedMealEntry[];
  streakCount: number;
  ratingStyle?: "family" | "summary";
  now?: number;
}): WeekPlanCelebrationPayload => {
  const mealById = new Map(meals.map(meal => [meal.id, meal]));
  const plannedIds = PLANNED_WEEK_ORDER.map(day => plan[day]).filter(
    (id): id is string => typeof id === "string" && (isSpecialMealId(id) || mealById.has(id)),
  );
  const plannedMeals = plannedIds.filter(id => !isSpecialMealId(id)).map(id => mealById.get(id)!);
  const explicitIngredients = plannedMeals.map(meal => ({ ...meal, ingredients: (meal.ingredients ?? []).filter(ingredient => typeof ingredient !== "string" && ingredient.ingredientType === "keyIngredient") }));
  const shared = new Set(explicitIngredients.flatMap((meal, index) =>
    getIngredientOverlap(meal, explicitIngredients.filter((_, other) => other !== index)).sharedIngredients.map(normalizeIngredientName),
  ));
  const stat = (id: WeekPlanCelebrationStat["id"], count: number, label: string): WeekPlanCelebrationStat => ({ id, value: String(count), label });
  const recordedServings = history.filter(entry => entry.outcome === "served" && Number.isFinite(Date.parse(entry.servedAtISO)) && Date.parse(entry.servedAtISO) <= now);
  const previouslyServedIds = new Set(recordedServings.map(entry => entry.mealId));
  const candidates = [
    stat("favorites", plannedMeals.filter(meal => ratingStyle === "summary" ? isFiveStarMeal(meal) : Object.values(meal.familyRatings ?? {}).some(value => value > 0) && isFamilyStarMeal(meal)).length, "Family Favorites"),
    stat("beenAwhile", getBeenAwhileMeals(plannedMeals.filter(meal => previouslyServedIds.has(meal.id)), recordedServings, 3, now).length, "Meals You Haven’t Had Lately"),
    stat("easy", getEasyMeals(plannedMeals.filter(meal => meal.difficulty === 1)).length, "Easy Meals"),
    stat("freezer", plannedMeals.filter(meal => (getRawFreezerMealAmount(meal) ?? 0) >= 1).length, "Freezer Meals"),
    stat("flex", plannedIds.filter(isFlexNightMealId).length, "Flex Nights"),
    stat("budget", getBudgetMeals(plannedMeals.filter(meal => typeof meal.expense === "number" && Number.isFinite(meal.expense) && meal.expense >= 1 && meal.expense <= 2)).length, "Budget-Friendly"),
    stat("shared", shared.size, "Shared Ingredients"),
  ].filter(item => Number(item.value) > 0);
  const stats = plannedIds.length ? [stat("dinners", plannedIds.length, "Dinners Planned"), ...candidates.slice(0, 2)] : [];
  return { dinnerCount: plannedIds.length, stats, streakCount };
};

export const WEEK_PLAN_STREAK_MILESTONES: Record<
  number,
  { title: string; message: string }
> = {
  5: { title: "5 weeks in a row!", message: "Your planning rhythm is taking shape." },
  10: { title: "10 weeks in a row!", message: "Dinner planning is officially a habit." },
  25: { title: "25 weeks in a row!", message: "You’ve made planning ahead second nature." },
  50: { title: "50 weeks in a row!", message: "An incredible year of calmer dinner planning." },
};

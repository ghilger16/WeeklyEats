export type CostTier = 1 | 2 | 3;

export type Meal = {
  id: string;
  title: string;
  emoji: string;
  rating: number;
  servedCount: number;
  showServedCount: boolean;
  plannedCostTier: CostTier;
  locked: boolean;
  isFavorite: boolean;
  recipeUrl?: string;
  ingredients?: string[];
  difficulty?: number;
  expense?: number;
  prepNotes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MealDraft = Omit<Meal, "id"> & {
  id?: string;
};

export const createEmptyMealDraft = (): MealDraft => ({
  title: "",
  emoji: "🍽️",
  rating: 3,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  recipeUrl: "",
  ingredients: [],
  difficulty: 3,
  expense: 3,
  prepNotes: "",
});

export const createMealId = () =>
  `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

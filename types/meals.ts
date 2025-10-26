export type CostTier = 1 | 2 | 3;

export type Meal = {
  id: string;
  title: string;
  emoji: string;
  rating: number;
  plannedCostTier: CostTier;
  locked: boolean;
  isFavorite: boolean;
};

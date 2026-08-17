import type { CuisineType } from "../../types/cuisine";

export type MealSortDirection =
  | "asc"
  | "desc"
  | "easy"
  | "medium"
  | "hard"
  | "cheap"
  | "mediumCost"
  | "expensive"
  | CuisineType;

export type MealSortBadgeType =
  | "default"
  | "difficulty"
  | "expense"
  | "cuisine";

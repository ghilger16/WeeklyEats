import { Meal } from "../types/meals";

const normalizeHalfStep = (value: number) =>
  Math.max(0.5, Math.round(value * 2) / 2);

export const getFreezerMealAmount = (
  meal?: Pick<Meal, "freezerMealAmount" | "freezerAmount" | "freezerQuantity" | "freezerUnit"> | null,
): number | null => {
  if (!meal) return null;
  if (
    typeof meal.freezerMealAmount === "number" &&
    Number.isFinite(meal.freezerMealAmount) &&
    meal.freezerMealAmount > 0
  ) {
    return normalizeHalfStep(meal.freezerMealAmount);
  }

  const legacyRaw = meal.freezerAmount?.trim()
    ? meal.freezerAmount
    : meal.freezerQuantity;
  if (typeof legacyRaw !== "string" || !legacyRaw.trim()) return null;
  const legacyAmount = Number(legacyRaw.trim());
  if (!Number.isFinite(legacyAmount) || legacyAmount <= 0) return null;
  const multiplier = meal.freezerUnit?.toLowerCase().includes("half serving")
    ? 0.5
    : 1;
  return normalizeHalfStep(legacyAmount * multiplier);
};

export const formatFreezerMealAmount = (amount: number): string => {
  const normalized = normalizeHalfStep(amount);
  const whole = Math.floor(normalized);
  const hasHalf = normalized % 1 === 0.5;
  if (normalized === 0.5) return "½ Meal";
  if (normalized === 1) return "1 Meal";
  return `${whole}${hasHalf ? "½" : ""} Meals`;
};

export const formatFreezerAvailability = (amount: number) =>
  `${formatFreezerMealAmount(amount).toLocaleLowerCase()} available`;

export const hasFullFreezerMeal = (meal?: Meal | null) =>
  (getFreezerMealAmount(meal) ?? 0) >= 1;

export const getFreezerUpdateAfterServing = (
  meal?: Meal | null,
): Partial<Meal> => {
  if (getFreezerMealAmount(meal) !== 1) return {};
  return {
    isFavorite: false,
    freezerMealAmount: undefined,
    freezerAmount: "",
    freezerQuantity: "",
    freezerUnit: "",
    freezerAddedAt: undefined,
  };
};

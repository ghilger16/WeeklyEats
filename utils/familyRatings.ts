import { FamilyRatingValue, Meal } from "../types/meals";

export const FAMILY_RATING_SEQUENCE: FamilyRatingValue[] = [3, 2, 1, 0];

const NEXT_RATING: Record<FamilyRatingValue, FamilyRatingValue> = {
  3: 2,
  2: 1,
  1: 0,
  0: 3,
};

export const getNextFamilyRating = (
  current: FamilyRatingValue
): FamilyRatingValue => NEXT_RATING[current] ?? 0;

export const setFamilyRatingValue = (
  ratings: Meal["familyRatings"],
  memberId: string,
  value: FamilyRatingValue
): Meal["familyRatings"] => {
  const next = { ...(ratings ?? {}) };
  if (value === 0) {
    delete next[memberId];
  } else {
    next[memberId] = value;
  }
  return Object.keys(next).length ? next : undefined;
};

export type FamilyRatingSummary = {
  average: number;
  ratedCount: number;
  isUnanimousHeart: boolean;
};

export const getFamilyRatingSummary = (
  ratings: Meal["familyRatings"],
  memberIds: string[]
): FamilyRatingSummary | null => {
  if (!ratings || memberIds.length === 0) return null;

  const ratedValues = memberIds
    .map((memberId) => ratings[memberId] ?? 0)
    .filter((value) => value > 0);
  if (ratedValues.length === 0) return null;

  const heartCount = memberIds.filter(
    (memberId) => ratings[memberId] === 3
  ).length;
  const isUnanimousHeart = heartCount === memberIds.length;
  const baseTotal = ratedValues.reduce<number>((total, value) => {
    if (value === 3) return total + 4;
    if (value === 2) return total + 3;
    return total + 1;
  }, 0);
  const consensusBonus = heartCount / memberIds.length;

  return {
    average: isUnanimousHeart
      ? 5
      : Math.min(4.9, baseTotal / ratedValues.length + consensusBonus),
    ratedCount: ratedValues.length,
    isUnanimousHeart,
  };
};

/** Planner-only contribution. Zero/unrecorded ratings are neutral, not dislikes. */
export const getFamilyRatingScore = (meal: Meal): number => {
  const memberIds = Object.keys(meal.familyRatings ?? {}).filter(
    (id) => [1, 2, 3].includes(meal.familyRatings![id]),
  );
  const summary = getFamilyRatingSummary(meal.familyRatings, memberIds);
  if (summary) {
    if (summary.isUnanimousHeart) return 12;
    const weights = { 1: -12, 2: 6, 3: 12 };
    return memberIds.reduce((sum, id) => {
      const rating = meal.familyRatings![id] as 1 | 2 | 3;
      return sum + weights[rating];
    }, 0) / memberIds.length;
  }
  // Legacy overall stars remain useful when individual family ratings are absent.
  const rating = Number.isFinite(meal.rating) ? Math.max(0, Math.min(5, meal.rating)) : 0;
  return rating === 0 ? 0 : Math.max(-12, Math.min(12, (rating - 3) * 6));
};

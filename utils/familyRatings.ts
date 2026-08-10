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

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

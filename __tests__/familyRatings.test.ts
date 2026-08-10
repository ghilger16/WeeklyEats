import { getFamilyRatingSummary } from "../utils/familyRatings";

describe("family rating summary", () => {
  it("reserves 5.0 for a heart from every family member", () => {
    expect(
      getFamilyRatingSummary({ a: 3, b: 3 }, ["a", "b"])
    ).toMatchObject({ average: 5, isUnanimousHeart: true });

    const partial = getFamilyRatingSummary({ a: 3 }, ["a", "b"]);
    expect(partial?.average).toBe(4.5);
    expect(partial?.isUnanimousHeart).toBe(false);
  });

  it("increases the score as more family members choose heart", () => {
    const oneHeart = getFamilyRatingSummary({ a: 3, b: 2, c: 2 }, ["a", "b", "c"]);
    const twoHearts = getFamilyRatingSummary({ a: 3, b: 3, c: 2 }, ["a", "b", "c"]);

    expect(twoHearts!.average).toBeGreaterThan(oneHeart!.average);
    expect(twoHearts!.average).toBeLessThan(5);
  });

  it("does not award 5.0 while any configured member is unrated", () => {
    const summary = getFamilyRatingSummary(
      { a: 3, b: 3, c: 3, d: 3 },
      ["a", "b", "c", "d", "e"]
    );

    expect(summary?.average).toBe(4.8);
    expect(summary?.ratedCount).toBe(4);
    expect(summary?.isUnanimousHeart).toBe(false);
  });
});

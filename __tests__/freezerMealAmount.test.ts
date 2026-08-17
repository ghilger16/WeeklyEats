import {
  formatFreezerAvailability,
  formatFreezerMealAmount,
  getFreezerMealAmount,
  getFreezerUpdateAfterServing,
  hasFullFreezerMeal,
} from "../utils/freezerMealAmount";

describe("freezer meal amounts", () => {
  it("formats whole and half family meals consistently", () => {
    expect(formatFreezerMealAmount(0.5)).toBe("½ Meal");
    expect(formatFreezerMealAmount(1)).toBe("1 Meal");
    expect(formatFreezerMealAmount(1.5)).toBe("1½ Meals");
    expect(formatFreezerMealAmount(2.5)).toBe("2½ Meals");
    expect(formatFreezerAvailability(1)).toBe("1 meal available");
  });

  it("prefers the canonical numeric value", () => {
    expect(getFreezerMealAmount({ freezerMealAmount: 1.5, freezerAmount: "8" })).toBe(1.5);
  });

  it("adapts legacy inventory without deleting it", () => {
    expect(getFreezerMealAmount({ freezerAmount: "2", freezerUnit: "Servings" })).toBe(2);
    expect(getFreezerMealAmount({ freezerAmount: "", freezerQuantity: "3" })).toBe(3);
    expect(getFreezerMealAmount({ freezerAmount: "1", freezerUnit: "Half Serving" })).toBe(0.5);
  });

  it("only treats one or more meals as a full freezer dinner", () => {
    expect(hasFullFreezerMeal({ freezerMealAmount: 0.5 } as never)).toBe(false);
    expect(hasFullFreezerMeal({ freezerMealAmount: 1 } as never)).toBe(true);
  });

  it("removes an exact one-meal freezer entry after serving", () => {
    expect(
      getFreezerUpdateAfterServing({
        isFavorite: true,
        freezerMealAmount: 1,
        freezerAddedAt: "2026-08-16",
      } as never),
    ).toMatchObject({
      isFavorite: false,
      freezerMealAmount: undefined,
      freezerAddedAt: undefined,
    });
    expect(
      getFreezerUpdateAfterServing({ freezerMealAmount: 0.5 } as never),
    ).toEqual({});
    expect(
      getFreezerUpdateAfterServing({ freezerMealAmount: 1.5 } as never),
    ).toEqual({});
  });
});

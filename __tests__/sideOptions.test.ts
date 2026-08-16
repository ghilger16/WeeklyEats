import {
  getSideOptionsForMeal,
  promoteSavedSides,
  replaceSideWithCustomOption,
  SideOption,
} from "../components/plan-week/inline/sideOptions";
import {
  CUISINE_SIDE_SUGGESTIONS,
  getSideSuggestions,
} from "../utils/cuisineSideSuggestions";
import { CUISINE_OPTIONS } from "../types/cuisine";
import { Meal } from "../types/meals";

const meal: Meal = {
  id: "meal",
  title: "Tacos",
  emoji: "🌮",
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 1,
  locked: false,
  isFavorite: false,
  cuisine: "mexican",
  suggestedSides: ["Corn"],
};

describe("cuisine side suggestions", () => {
  it("has a curated list for every supported cuisine", () => {
    expect(Object.keys(CUISINE_SIDE_SUGGESTIONS).sort()).toEqual(
      CUISINE_OPTIONS.map((option) => option.value).sort(),
    );
    CUISINE_OPTIONS.forEach((option) => {
      expect(CUISINE_SIDE_SUGGESTIONS[option.value].length).toBeGreaterThanOrEqual(6);
    });
  });

  it("returns at most six suggestions and excludes saved sides", () => {
    expect(
      getSideSuggestions({ cuisine: "mexican", savedSides: ["Spanish Rice", " corn "] }),
    ).toEqual([
      "Refried Beans",
      "Chips & Salsa",
      "Guacamole",
      "Side Salad",
      "Black Beans",
      "Fruit",
    ]);
  });

  it("uses generic suggestions when cuisine is not set", () => {
    expect(getSideSuggestions({ savedSides: [] })).toEqual([
      "Side Salad",
      "Green Beans",
      "Broccoli",
      "Corn",
      "Rice",
      "Roasted Potatoes",
    ]);
  });
});

describe("inline side options", () => {
  it("prioritizes saved sides and follows them with cuisine suggestions", () => {
    const options = getSideOptionsForMeal(meal, ["Guacamole"]);

    expect(options.slice(0, 2)).toEqual([
      { name: "Guacamole", isCustom: true },
      { name: "Corn", isCustom: true },
    ]);
    expect(options).toHaveLength(6);
    expect(options.filter((option) => !option.isCustom)).toHaveLength(4);
    expect(options.some((option) => option.name === "Corn" && !option.isCustom)).toBe(false);
  });

  it("keeps saved sides while cuisine suggestions change", () => {
    const mexican = getSideOptionsForMeal(meal);
    const american = getSideOptionsForMeal({ ...meal, cuisine: "american" });

    expect(mexican[0]).toEqual({ name: "Corn", isCustom: true });
    expect(american[0]).toEqual({ name: "Corn", isCustom: true });
    expect(mexican.some((option) => option.name === "Spanish Rice")).toBe(true);
    expect(american.some((option) => option.name === "French Fries")).toBe(true);
  });

  it("adds and selects a custom side without removing saved choices", () => {
    const options: SideOption[] = [
      { name: "Corn", isCustom: true },
      { name: "Spanish Rice", isCustom: false },
    ];
    const result = replaceSideWithCustomOption(options, ["Corn"], " Egg Rolls ");

    expect(result?.options.slice(0, 2)).toEqual([
      { name: "Egg Rolls", isCustom: true },
      { name: "Corn", isCustom: true },
    ]);
    expect(result?.selectedSides).toEqual(["Corn", "Egg Rolls"]);
  });

  it("rejects blank and case-insensitive duplicate custom sides", () => {
    const options = getSideOptionsForMeal(meal);
    expect(replaceSideWithCustomOption(options, [], "   ")).toBeNull();
    expect(replaceSideWithCustomOption(options, [], " corn ")).toBeNull();
  });

  it("moves explicitly selected sides to the front of saved meal sides", () => {
    expect(promoteSavedSides(["Broccoli", " corn "], ["Corn", "Rice"]))
      .toEqual(["Broccoli", "corn", "Rice"]);
  });
});

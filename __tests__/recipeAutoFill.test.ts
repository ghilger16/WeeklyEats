import { normalizeSuggestedSides } from "../utils/recipeAutoFill";

describe("normalizeSuggestedSides", () => {
  it("trims, deduplicates case-insensitively, and caps sides at six", () => {
    expect(
      normalizeSuggestedSides([
        "  Mexican Rice ",
        "Corn",
        "corn",
        "Black   Beans",
        "Salad",
        "Avocado",
        "Fruit",
        "Naan",
      ]),
    ).toEqual([
      "Mexican Rice",
      "Corn",
      "Black Beans",
      "Salad",
      "Avocado",
      "Fruit",
    ]);
  });

  it("treats malformed sides as optional metadata", () => {
    expect(normalizeSuggestedSides(undefined)).toEqual([]);
    expect(normalizeSuggestedSides("Rice")).toEqual([]);
    expect(normalizeSuggestedSides([null, "", 42, "  "])).toEqual([]);
  });
});

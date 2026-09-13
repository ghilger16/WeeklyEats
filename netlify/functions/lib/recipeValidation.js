const { canonicalIngredientName, cleanIngredientName, isBasicSaltOrPepper } = require("../../../utils/ingredientNormalization");
const isWater = (name) => /^(?:(?:cold|warm|hot|boiling|lukewarm|ice|filtered)\s+)?water$/i.test(cleanIngredientName(name));
const isServingOnly = (name) => /\b(?:for serving|to serve|for garnish|as garnish|optional garnish|serving suggestion|recommended side)\b/i.test(name);
const expectedNames = (source) => new Set(source.ingredients
  .filter((line) => !isBasicSaltOrPepper(line) && !isWater(line) && !isServingOnly(line))
  .map(canonicalIngredientName).filter(Boolean).map((name) => name.toLowerCase()));
const ingredientCountCheck = (source, ingredients) => {
  const expectedCount = expectedNames(source).size;
  return { sourceCount: source.ingredients.length, expectedCount, resultCount: ingredients.length,
    suspicious: (expectedCount >= 4 && ingredients.length < expectedCount * 0.7) || ingredients.length > source.ingredients.length };
};
const tokens = (name) => canonicalIngredientName(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
const supportedBy = (name, line) => {
  const sourceTokens = new Set(tokens(line));
  const ingredientTokens = tokens(name);
  return ingredientTokens.length > 0 && ingredientTokens.every((token) => sourceTokens.has(token));
};
const validateIngredientCorrection = (result, source) => {
  if (!result || typeof result.valid !== "boolean" || !Array.isArray(result.missingIngredients) || !Array.isArray(result.inventedIngredients) ||
      !Array.isArray(result.correctedIngredients) || !Array.isArray(result.excludedSourceIngredients)) throw new Error("Malformed ingredient validation response.");
  const covered = new Set();
  const corrected = result.correctedIngredients;
  const validIndex = (index) => Number.isInteger(index) && index >= 0 && index < source.ingredients.length;
  for (const item of corrected) {
    if (!item || typeof item.name !== "string" || !Array.isArray(item.sourceIndices) || !item.sourceIndices.length) throw new Error("Missing ingredient source reference.");
    for (const index of item.sourceIndices) {
      if (!validIndex(index) || !supportedBy(item.name, source.ingredients[index])) throw new Error("Ingredient not supported by its source.");
      covered.add(index);
    }
  }
  for (const excluded of result.excludedSourceIngredients) {
    if (!excluded || !validIndex(excluded.index)) throw new Error("Invalid ingredient exclusion.");
    const line = source.ingredients[excluded.index];
    const justified =
      (excluded.reason === "saltPepper" && isBasicSaltOrPepper(line)) ||
      (excluded.reason === "water" && isWater(line)) ||
      (excluded.reason === "servingOnly" && isServingOnly(line)) ||
      (excluded.reason === "duplicate" && corrected.some((item) => supportedBy(item.name, line)));
    if (!justified) throw new Error("Unjustified ingredient exclusion.");
    covered.add(excluded.index);
  }
  source.ingredients.forEach((line, index) => {
    if (!covered.has(index) && !isBasicSaltOrPepper(line) && !isWater(line) && !isServingOnly(line)) throw new Error("Required source ingredient missing after validation.");
  });
  return corrected.map(({ name, category, ingredientType }) => ({ name, category, ingredientType }));
};
// Contiguous bands: [0,3), [3,5), [5,8), [8,10], (10,infinity).
const expenseFromCost = (cost) => {
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) throw new Error("Missing cost-per-person estimate.");
  return cost < 3 ? 1 : cost < 5 ? 2 : cost < 8 ? 3 : cost <= 10 ? 4 : 5;
};
module.exports = { ingredientCountCheck, validateIngredientCorrection, expenseFromCost };

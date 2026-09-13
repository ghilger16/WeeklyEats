// Fetch and inspect a public recipe using the production extractor, without an AI call.
// Usage: node scripts/diagnose-recipe-import.js https://example.com/recipe
const { extractRecipeSource } = require("../netlify/functions/lib/recipeSource");
(async () => {
  let diagnostics = { hostname: null, status: null, htmlReturned: false, responseLength: 0,
    jsonLdFound: false, recipeSchemaFound: false, recipeIngredientFound: false, appearsBlocked: false };
  try {
    const url = new URL(process.argv[2]);
    diagnostics.hostname = url.hostname;
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Use an HTTP(S) recipe URL.");
    const response = await fetch(url, { headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "WeeklyEatsBot/1.0" }, signal: AbortSignal.timeout(15000) });
    diagnostics.status = response.status;
    const html = await response.text();
    const result = extractRecipeSource(html, response.url);
    diagnostics = { ...diagnostics, htmlReturned: /<(?:!doctype|html|head|body|script|div|h1)\b/i.test(html), responseLength: html.length,
      ...result.diagnostics, sourceKind: result.source?.kind ?? null, ingredientCount: result.source?.ingredients.length ?? 0,
      reason: !response.ok ? `HTTP ${response.status}` : result.error ?? "Recipe source extracted successfully." };
    if (!response.ok || !result.source) process.exitCode = 1;
  } catch (error) { diagnostics.reason = error.message; process.exitCode = 1; }
  console.log(JSON.stringify(diagnostics, null, 2));
})();

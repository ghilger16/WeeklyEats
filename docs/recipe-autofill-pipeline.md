# Recipe-link Auto Fill

`netlify/functions/recipeAutoFill.js` fetches the recipe, builds the meal prompt, calls the model, validates ingredients and returns the existing public meal shape. `hooks/useRecipeAutoFill.ts` sends the current family-member count (default 4), retains the existing loading/error experience, and is used by both creation and completion flows. `utils/recipeMealDraft.ts` prepares imports; the existing meal-library and planner assignment helpers still save them.

## Extraction and fidelity

`lib/recipeSource.js` uses parse5 to inspect JSON-LD before any text truncation. It supports objects, arrays, nested `@graph`, array-valued Recipe types and nested instruction sections. An identified main Recipe or URL-matched Recipe is preferred; ambiguous unrelated recipes are rejected. Recipe ingredients remain authoritative. Without them, the fallback checks `recipeIngredient` microdata or a bounded Ingredients section, never a title/URL alone. Text fallback requires identifiable ingredient content and conservatively fails if it cannot find it.

Each recipe import uses one meal-generation call and one focused ingredient-validation call. The second response must account for every source line using source indices or justified exclusions; unsupported names, incomplete coverage, malformed responses and validator failures return the normal failure state instead of an unvalidated meal. The count check highlights large omissions but does not require equal counts. Validation keeps the public ingredient shape unchanged: source references are internal only.

`utils/ingredientNormalization.js` is shared by the server, app preparation, and planned grocery-item generation. Exact aliases canonicalize ingredient names and deduplicate repeated imports. Basic salt/pepper are excluded; meaningful spices, different proteins/cuts and different cheeses remain distinct. Existing meal-library records are not batch-migrated; generated grocery items apply normalization as they are rebuilt.

Expense uses an internal approximate consumed-ingredient cost per person, including quantities and source yield when available. The server maps USD values continuously: below 3 → 1; 3–below 5 → 2; 5–below 8 → 3; 8–10 → 4; above 10 → 5. This resolves gaps/overlap in the requested approximate bands. No cost field is added to the public Meal. The app preserves all five values instead of snapping 2/4 to 3/5. These remain model estimates, not fetched store prices.

## Diagnostics and Allrecipes

Enable `AUTO_FILL_DEBUG=true` or `NETLIFY_DEV=true` on the function for metadata-only logs: hostname, HTTP status, HTML presence/length, JSON-LD parse errors, Recipe/ingredient presence, challenge detection, count checks, and failure stage. Full page HTML is never logged.

Run without an AI key:

```sh
node scripts/diagnose-recipe-import.js https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/
```

On 2026-09-12, a curl request using the production Accept and User-Agent headers returned HTTP 403, text/html, approximately 680,362 characters, no JSON-LD and no Recipe ingredients. Its body had a JavaScript/cookie challenge and `window._cf_chl_opt`. This is a host-block response in this environment, not a JSON-LD parser error. The subsequent diagnostic command using Node’s production fetch path returned HTTP 200, 556,622 HTML characters, one valid JSON-LD Recipe and all seven source ingredient lines. No JSON-LD parsing errors were reported. Different clients/requests can receive different host responses; the 403 does not establish that all imports are blocked. No challenge bypass or site-specific selectors were added. Repeat the command in the deployment environment to diagnose its response. Production Netlify access has not been verified.

Accessible recipe pages with usable JSON-LD now take the structured path; blocked pages fail safely. Live model validation requires an API key; fixture tests mock the model to verify corrections, coverage, error behavior and request count.

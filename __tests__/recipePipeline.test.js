const { extractRecipeSource } = require('../netlify/functions/lib/recipeSource');
const { canonicalIngredientName, normalizeIngredientNames } = require('../utils/ingredientNormalization');
const { ingredientCountCheck, validateIngredientCorrection, expenseFromCost } = require('../netlify/functions/lib/recipeValidation');
const schema = (value) => `<html><script type="application/ld+json">${JSON.stringify(value)}</script></html>`;
const recipe = { '@type': 'Recipe', name: 'Chicken Dinner', recipeIngredient: ['2 boneless skinless chicken breasts', '1 yellow onion', '1 teaspoon salt', '1 teaspoon black pepper'], recipeInstructions: [{ '@type': 'HowToSection', name: 'Sauce', itemListElement: [{ '@type': 'HowToStep', text: 'Cook the onion.' }] }], recipeCuisine: 'American', recipeCategory: 'Dinner', recipeYield: '4 servings' };
const url = 'https://example.com/dinner';
const ingredient = (name, sourceIndices) => ({ name, category: 'produce', ingredientType: 'keyIngredient', sourceIndices });
const correction = { valid: false, missingIngredients: ['Onion'], inventedIngredients: ['Rice'], correctedIngredients: [ingredient('Chicken Breast', [0]), ingredient('Onion', [1])], excludedSourceIngredients: [{ index: 2, reason: 'saltPepper' }, { index: 3, reason: 'saltPepper' }] };

it.each([recipe, [ { '@type': 'WebSite' }, recipe ], { '@graph': [{ '@type': 'Organization' }, { ...recipe, '@type': ['Thing', 'Recipe'] }] }, { mainEntity: recipe }])('finds Recipe JSON-LD through all supported nesting forms', (value) => {
  const { source, diagnostics } = extractRecipeSource(schema(value), url);
  expect(source.ingredients).toEqual(recipe.recipeIngredient);
  expect(source.instructions).toContain('Cook the onion.');
  expect(diagnostics.jsonLdFound).toBe(true);
});
it('uses JSON-LD even beyond the former 12k truncation, ignoring unrelated article ingredients', () => {
  const html = '<p>Try adding bacon and rice.</p>'.repeat(900) + schema(recipe);
  expect(extractRecipeSource(html, url).source.ingredients).toEqual(recipe.recipeIngredient);
});
it('recovers a valid JSON-LD block after a malformed unrelated one', () => {
  const result = extractRecipeSource('<script type="application/ld+json">{bad}</script>' + schema(recipe), url);
  expect(result.diagnostics.jsonLdParseErrors).toBe(1);
  expect(result.source.kind).toBe('json-ld');
});
it('rejects title-only, blocked and ambiguous recipe pages', () => {
  expect(extractRecipeSource('<h1>Chicken Dinner</h1>', url).source).toBeUndefined();
  const blocked = extractRecipeSource('<noscript>Enable JavaScript and cookies to continue</noscript><script>window._cf_chl_opt={}</script>', url);
  expect(blocked.diagnostics.appearsBlocked).toBe(true);
  expect(blocked.source).toBeUndefined();
  expect(extractRecipeSource(schema([recipe, { ...recipe, name: 'Other' }]), url).source).toBeUndefined();
});
it('uses a bounded ingredient section and excludes surrounding prose and serving-only sections', () => {
  const result = extractRecipeSource('<h1>Dinner</h1><p>Add bacon if you like</p><h2>Ingredients</h2><h3>Sauce</h3><ul><li>1 onion</li><li>2 cups tomatoes</li></ul><h3>To Serve</h3><li>1 cup rice</li><h2>Instructions</h2><p>Cook sauce.</p>', url);
  expect(result.source.ingredients).toEqual(['1 onion', '2 cups tomatoes']);
  expect(result.source.instructions).toBe('Cook sauce.');
});
it('reads ingredient list items without quantities', () => {
  expect(extractRecipeSource('<h1>Soup</h1><h2>Ingredients</h2><ul><li>Chicken Breast</li><li>Onion</li></ul><h2>Directions</h2><p>Simmer.</p>', url).source.ingredients).toEqual(['Chicken Breast', 'Onion']);
});
it('supports ingredient microdata', () => {
  expect(extractRecipeSource('<h1>Dinner</h1><li itemprop="recipeIngredient">2 onions</li>', url).source.ingredients).toEqual(['2 onions']);
});
it.each([
  ['boneless skinless chicken breasts', 'Chicken Breast'], ['chicken breasts', 'Chicken Breast'],
  ['2 cups extra virgin olive oil', 'Olive Oil'], ['1 yellow onion, chopped', 'Onion'],
  ['shredded cheddar', 'Cheddar Cheese'], ['sharp cheddar cheese', 'Cheddar Cheese'],
  ['cheese', 'Cheese'], ['mozzarella cheese', 'Mozzarella Cheese'], ['chicken thigh', 'Chicken Thigh'],
  ['cloves', 'Cloves'], ['pound cake', 'Pound Cake'], ['2% milk', '2% Milk'], ['ground beef', 'Ground Beef'], ['steak', 'Steak'], ['heavy cream', 'Heavy Cream'], ['milk', 'Milk'],
  ['red pepper flakes', 'Red Pepper Flakes'], ['pepper jack cheese', 'Pepper Jack Cheese'],
  ['1½ cups flour', 'Flour'], ['½ teaspoon paprika', 'Paprika'],
])('canonicalizes %s without inventing specificity', (input, output) => expect(canonicalIngredientName(input)).toBe(output));
it.each(['salt', 'kosher salt', 'sea salt', 'table salt', 'black pepper', 'ground black pepper', 'freshly ground pepper', '1 pinch salt', 'salt and pepper to taste'])('excludes %s', (name) => expect(canonicalIngredientName(name)).toBe(''));
it('deduplicates aliases and preserves real spices', () => {
  expect(normalizeIngredientNames(['white onion', 'yellow onion', 'salt', 'paprika']).map((item) => item.name)).toEqual(['Onion', 'Paprika']);
});
it('flags major omissions while allowing salt/pepper exclusions', () => {
  expect(ingredientCountCheck({ ingredients: Array.from({ length: 15 }, (_, i) => `ingredient ${i}`) }, Array(5).fill({})).suspicious).toBe(true);
  expect(ingredientCountCheck({ ingredients: recipe.recipeIngredient }, [ {}, {} ]).suspicious).toBe(false);
});
it('applies corrections only when every required ingredient has a supported source', () => {
  const source = { ingredients: recipe.recipeIngredient };
  expect(validateIngredientCorrection(correction, source).map((item) => item.name)).toEqual(['Chicken Breast', 'Onion']);
  expect(() => validateIngredientCorrection({ ...correction, correctedIngredients: [ingredient('Rice', [0])] }, source)).toThrow();
  expect(() => validateIngredientCorrection({ ...correction, correctedIngredients: [ingredient('Chicken Breast', [0])] }, source)).toThrow();
  expect(() => validateIngredientCorrection({ ...correction, excludedSourceIngredients: [{ index: 1, reason: 'water' }] }, source)).toThrow();
});
it.each([[0,1],[2.99,1],[3,2],[4.99,2],[5,3],[7.99,3],[8,4],[10,4],[10.01,5]])('maps cost %s to expense %s', (cost, expense) => expect(expenseFromCost(cost)).toBe(expense));
it.each([-1, NaN, Infinity, undefined, '4'])('rejects invalid cost %s', (cost) => expect(() => expenseFromCost(cost)).toThrow());

const modelResponse = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });
const generated = { title: 'Chicken Dinner', ingredients: [ingredient('Chicken Breast'), ingredient('Rice')], cuisine: 'american', difficulty: 2, expense: 5, estimatedCostPerPerson: 3.5, matchesExistingMeal: false, matchConfidence: 0.9, prepNotes: 'Marinate.', suggestedSides: ['Salad'] };
describe('import handler', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; global.fetch = jest.fn(); process.env.OPENAI_API_KEY = 'test-key'; });
  afterEach(() => { global.fetch = originalFetch; delete process.env.OPENAI_API_KEY; });
  it('fetches once, runs one generation and one focused validation, preserving the public shape', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, url, text: async () => schema(recipe) })
      .mockResolvedValueOnce(modelResponse(generated)).mockResolvedValueOnce(modelResponse(correction));
    const { handler } = require('../netlify/functions/recipeAutoFill');
    const result = JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ url, householdSize: 2, existingMealTitle: 'Burgers' }) })).body);
    expect(result.ok).toBe(true);
    expect(result.data.ingredients.map((item) => item.name)).toEqual(['Chicken Breast', 'Onion']);
    expect(result.data.expense).toBe(2);
    expect(result.data.matchesExistingMeal).toBe(false);
    expect(result.data.matchConfidence).toBe(.9);
    expect(result.data.estimatedCostPerPerson).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const prompt = JSON.parse(global.fetch.mock.calls[1][1].body).messages[1].content;
    expect(prompt).toContain('2 people');
    expect(prompt).toContain('Burgers');
  });
  it('uses the default household size and logs metadata instead of page HTML on failure', async () => {
    process.env.AUTO_FILL_DEBUG = 'true';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403, url, text: async () => '<h1>Access denied</h1><p>DO_NOT_LOG_THIS_HTML</p>' });
    const { handler } = require('../netlify/functions/recipeAutoFill');
    await handler({ httpMethod: 'POST', body: JSON.stringify({ url }) });
    expect(log).toHaveBeenCalledWith('[AutoFill Diagnostics]', expect.objectContaining({ hostname: 'example.com', status: 403, htmlReturned: true, jsonLdFound: false, recipeSchemaFound: false, recipeIngredientFound: false, appearsBlocked: true }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('DO_NOT_LOG_THIS_HTML');
    log.mockRestore();
    delete process.env.AUTO_FILL_DEBUG;
    const prompt = require('../netlify/functions/recipeAutoFill')._test.buildOpenAiPayload(url, { ingredients: ['Chicken'] });
    expect(prompt.messages[1].content).toContain('4 people');
  });
  it('preserves title-only ingredient suggestions without requiring recipe validation', async () => {
    global.fetch.mockResolvedValueOnce(modelResponse({ ingredients: [ingredient('Chicken Breast'), ingredient('Salt')] }));
    const { handler } = require('../netlify/functions/recipeAutoFill');
    const result = JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ suggestionTitle: 'Chicken' }) })).body);
    expect(result.data.ingredients.map((item) => item.name)).toEqual(['Chicken Breast']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not call the model for blocked HTML', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403, url, text: async () => '<h1>Access denied</h1>' });
    const { handler } = require('../netlify/functions/recipeAutoFill');
    expect(JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ url }) })).body).ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not save when validation fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, url, text: async () => schema(recipe) })
      .mockResolvedValueOnce(modelResponse(generated)).mockResolvedValueOnce(modelResponse({ valid: true }));
    const { handler } = require('../netlify/functions/recipeAutoFill');
    expect(JSON.parse((await handler({ httpMethod: 'POST', body: JSON.stringify({ url }) })).body).ok).toBe(false);
  });
});

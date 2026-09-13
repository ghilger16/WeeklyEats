const { canonicalIngredientName, normalizeIngredientNames } = require('../utils/ingredientNormalization');

it.each([
  ['Canned Black Beans', 'Black Beans'], ['Black Beans, drained', 'Black Beans'],
  ['Drained Black Beans', 'Black Beans'], ['Rinsed Pinto Beans', 'Pinto Beans'],
  ['Corn Kernels', 'Corn'], ['Frozen Corn', 'Corn'], ['Fresh Corn', 'Corn'],
  ['Frozen Corn Kernels', 'Corn'], ['Fresh Corn Kernels', 'Corn'],
  ['Spring Onions', 'Green Onions'], ['Scallions', 'Green Onions'],
  ['Yellow Onion', 'Onion'], ['White Onion', 'Onion'],
  ['Extra Virgin Olive Oil', 'Olive Oil'],
  ['Shredded Cheddar Cheese', 'Cheddar Cheese'], ['Sharp Cheddar Cheese', 'Cheddar Cheese'],
  ['Shredded Mozzarella Cheese', 'Mozzarella Cheese'], ['Grated Parmesan Cheese', 'Parmesan Cheese'],
  ['Chopped Onion', 'Onion'], ['Diced Onion', 'Onion'], ['Fresh Cilantro', 'Cilantro'],
  ['Diced Red Bell Pepper', 'Red Bell Pepper'], ['Minced Garlic', 'Garlic'],
  ['Finely Chopped Fresh Cilantro', 'Cilantro'], ['Thinly Sliced Green Onions', 'Green Onions'],
  ['Roughly Chopped Onion', 'Onion'], ['Crushed Garlic', 'Garlic'],
  ['Packed Cilantro', 'Cilantro'], ['  FROZEN   CORN KERNELS  ', 'Corn'],
])('canonicalizes %s to %s', (input, expected) => {
  expect(canonicalIngredientName(input)).toBe(expected);
  expect(canonicalIngredientName(expected)).toBe(expected);
});

it.each([
  'Black Beans', 'Pinto Beans', 'Tomato Sauce', 'Tomato Paste', 'Creamed Corn',
  'Corn Tortillas', 'Flour Tortillas', 'Chicken Breast', 'Chicken Thigh',
  'Ground Beef', 'Steak', 'Heavy Cream', 'Milk', 'Cheddar Cheese',
  'Mozzarella Cheese', 'Mexican Cheese Blend', 'Green Onions', 'Onion',
  'Crushed Tomatoes', 'Fresh Pasta', 'Packed Brown Sugar', 'Frozen Yogurt',
  'Canned Creamed Corn', 'Corn Kernel Oil',
])('preserves ingredient identity: %s', (name) => {
  expect(canonicalIngredientName(name)).toBe(name);
});

it('deduplicates variants while preserving metadata and original objects', () => {
  const first = { name: 'Frozen Corn Kernels', category: 'frozen', ingredientType: 'keyIngredient' };
  const result = normalizeIngredientNames([first, { name: 'Fresh Corn', category: 'produce', ingredientType: 'keyIngredient' }, { name: 'Creamed Corn', category: 'canned', ingredientType: 'pantryStaple' }]);
  expect(result).toEqual([{ ...first, name: 'Corn' }, { name: 'Creamed Corn', category: 'canned', ingredientType: 'pantryStaple' }]);
  expect(first.name).toBe('Frozen Corn Kernels');
});

export const DEFAULT_MEAL_EMOJI = "🍽️";

export type EmojiCatalogEntry = {
  emoji: string;
  label: string;
  keywords: string[];
};

// Extended food + drink catalog (hundreds of options) to give broader meal icon choices.
const FOOD_AND_DRINK_CATALOG: EmojiCatalogEntry[] = [
  // Meals & mains
  { emoji: "🍕", label: "Pizza", keywords: ["pizza", "pepperoni", "margherita"] },
  { emoji: "🍔", label: "Burger", keywords: ["burger", "cheeseburger", "hamburger", "sliders"] },
  { emoji: "🌭", label: "Hot Dog", keywords: ["hotdog", "hot dog", "sausage", "brat"] },
  { emoji: "🍟", label: "Fries", keywords: ["fries", "chips"] },
  { emoji: "🍖", label: "BBQ", keywords: ["bbq", "ribs", "steak", "brisket"] },
  { emoji: "🥩", label: "Steak", keywords: ["steak", "beef", "sirloin", "ribeye"] },
  { emoji: "🍗", label: "Chicken", keywords: ["chicken", "drumstick", "wings"] },
  { emoji: "🍖", label: "Meat Bone", keywords: ["meat on bone", "bbq"] },
  { emoji: "🥓", label: "Bacon", keywords: ["bacon"] },
  { emoji: "🍤", label: "Tempura Shrimp", keywords: ["tempura", "shrimp"] },
  { emoji: "🦐", label: "Shrimp", keywords: ["shrimp", "prawns"] },
  { emoji: "🦞", label: "Lobster", keywords: ["lobster", "seafood"] },
  { emoji: "🦀", label: "Crab", keywords: ["crab", "seafood"] },
  { emoji: "🦑", label: "Squid", keywords: ["squid", "calamari"] },
  { emoji: "🦪", label: "Oyster", keywords: ["oyster", "shellfish"] },
  { emoji: "🐟", label: "Fish", keywords: ["salmon", "fish", "cod", "halibut", "trout"] },
  { emoji: "🥪", label: "Sandwich", keywords: ["sandwich", "sub", "panini", "blt"] },
  { emoji: "🌮", label: "Taco", keywords: ["taco", "quesadilla", "mexican"] },
  { emoji: "🌯", label: "Burrito", keywords: ["burrito", "wrap"] },
  { emoji: "🫔", label: "Tamale", keywords: ["tamale", "mexican"] },
  { emoji: "🥙", label: "Gyro", keywords: ["gyro", "pita", "shawarma", "falafel"] },
  { emoji: "🥙", label: "Wrap", keywords: ["wrap", "pita"] },
  { emoji: "🥡", label: "Takeout Box", keywords: ["stir fry", "lo mein", "takeout", "chinese"] },
  { emoji: "🥢", label: "Noodles", keywords: ["ramen", "pho", "noodles", "udon"] },
  { emoji: "🍜", label: "Soup Bowl", keywords: ["soup", "broth", "ramen", "pho", "stew", "chili"] },
  { emoji: "🍲", label: "Stew", keywords: ["stew", "curry", "gumbo"] },
  { emoji: "🍝", label: "Pasta", keywords: ["pasta", "spaghetti", "linguine", "lasagna"] },
  { emoji: "🍛", label: "Curry", keywords: ["curry", "masala", "vindaloo"] },
  { emoji: "🍣", label: "Sushi", keywords: ["sushi", "sashimi", "nigiri", "maki"] },
  { emoji: "🍱", label: "Bento", keywords: ["bento", "japanese", "lunchbox"] },
  { emoji: "🥟", label: "Dumpling", keywords: ["dumpling", "potsticker", "pierogi"] },
  { emoji: "🍙", label: "Rice Ball", keywords: ["onigiri", "rice ball"] },
  { emoji: "🍚", label: "Rice Bowl", keywords: ["rice", "fried rice", "pilaf"] },
  { emoji: "🍘", label: "Rice Cracker", keywords: ["rice cracker"] },
  { emoji: "🍢", label: "Oden", keywords: ["oden", "skewer"] },
  { emoji: "🍡", label: "Dango", keywords: ["dango", "skewer", "dessert"] },
  { emoji: "🍥", label: "Narutomaki", keywords: ["narutomaki", "fish cake"] },
  { emoji: "🧆", label: "Falafel", keywords: ["falafel", "mediterranean"] },
  { emoji: "🥘", label: "Paella", keywords: ["paella", "skillet", "casserole"] },
  { emoji: "🥣", label: "Bowl", keywords: ["bowl", "cereal", "porridge", "oatmeal"] },
  { emoji: "🍳", label: "Breakfast", keywords: ["breakfast", "eggs", "omelette", "brunch", "scramble"] },
  { emoji: "🥞", label: "Pancakes", keywords: ["pancake", "waffle", "crepe"] },
  { emoji: "🧇", label: "Waffles", keywords: ["waffle"] },
  { emoji: "🥯", label: "Bagel", keywords: ["bagel", "lox", "breakfast"] },
  { emoji: "🥨", label: "Pretzel", keywords: ["pretzel", "snack"] },
  { emoji: "🥫", label: "Canned Food", keywords: ["casserole", "chili", "soup"] },
  { emoji: "🍿", label: "Popcorn", keywords: ["popcorn", "movie", "snack"] },
  // Bread, carbs & grains
  { emoji: "🍞", label: "Bread", keywords: ["bread", "toast", "loaf"] },
  { emoji: "🥖", label: "Baguette", keywords: ["baguette", "french bread"] },
  { emoji: "🥐", label: "Croissant", keywords: ["croissant", "pastry"] },
  { emoji: "🥔", label: "Potato", keywords: ["potato", "fries", "mash", "baked potato"] },
  { emoji: "🍠", label: "Sweet Potato", keywords: ["sweet potato", "yam"] },
  { emoji: "🍚", label: "Rice", keywords: ["rice", "bowl"] },
  // Veggies & produce
  { emoji: "🥦", label: "Broccoli", keywords: ["broccoli"] },
  { emoji: "🥬", label: "Leafy Greens", keywords: ["greens", "spinach", "kale"] },
  { emoji: "🥒", label: "Cucumber", keywords: ["cucumber", "pickles"] },
  { emoji: "🌶️", label: "Chili Pepper", keywords: ["spicy", "pepper", "chili"] },
  { emoji: "🌽", label: "Corn", keywords: ["corn", "cob"] },
  { emoji: "🥕", label: "Carrot", keywords: ["carrot", "root"] },
  { emoji: "🫑", label: "Bell Pepper", keywords: ["pepper", "capsicum"] },
  { emoji: "🍆", label: "Eggplant", keywords: ["eggplant", "aubergine"] },
  { emoji: "🥑", label: "Avocado", keywords: ["avocado", "guac"] },
  { emoji: "🍄", label: "Mushroom", keywords: ["mushroom"] },
  { emoji: "🧄", label: "Garlic", keywords: ["garlic"] },
  { emoji: "🧅", label: "Onion", keywords: ["onion"] },
  { emoji: "🫒", label: "Olives", keywords: ["olive", "mediterranean"] },
  // Fruits
  { emoji: "🍇", label: "Grapes", keywords: ["grape"] },
  { emoji: "🍈", label: "Melon", keywords: ["melon"] },
  { emoji: "🍉", label: "Watermelon", keywords: ["watermelon"] },
  { emoji: "🍊", label: "Orange", keywords: ["orange", "citrus"] },
  { emoji: "🍋", label: "Lemon", keywords: ["lemon", "citrus"] },
  { emoji: "🍌", label: "Banana", keywords: ["banana"] },
  { emoji: "🍍", label: "Pineapple", keywords: ["pineapple", "hawaiian"] },
  { emoji: "🥭", label: "Mango", keywords: ["mango"] },
  { emoji: "🍎", label: "Apple", keywords: ["apple", "cider"] },
  { emoji: "🍏", label: "Green Apple", keywords: ["apple", "granny smith"] },
  { emoji: "🍐", label: "Pear", keywords: ["pear"] },
  { emoji: "🍑", label: "Peach", keywords: ["peach"] },
  { emoji: "🍒", label: "Cherry", keywords: ["cherry"] },
  { emoji: "🍓", label: "Strawberry", keywords: ["strawberry", "fruit", "berries"] },
  { emoji: "🫐", label: "Blueberries", keywords: ["blueberry", "berries"] },
  { emoji: "🥝", label: "Kiwi", keywords: ["kiwi"] },
  { emoji: "🍅", label: "Tomato", keywords: ["tomato", "caprese"] },
  { emoji: "🍑", label: "Stone Fruit", keywords: ["stone fruit", "peach"] },
  { emoji: "🍒", label: "Berries", keywords: ["berries", "fruit"] },
  // Snacks & sweets
  { emoji: "🍪", label: "Cookie", keywords: ["cookie"] },
  { emoji: "🍩", label: "Donut", keywords: ["donut", "doughnut"] },
  { emoji: "🧁", label: "Cupcake", keywords: ["cupcake"] },
  { emoji: "🍰", label: "Cake", keywords: ["cake", "birthday"] },
  { emoji: "🍫", label: "Chocolate", keywords: ["chocolate", "brownie"] },
  { emoji: "🍨", label: "Ice Cream", keywords: ["ice cream", "dessert", "gelato"] },
  { emoji: "🍦", label: "Soft Serve", keywords: ["soft serve"] },
  { emoji: "🍧", label: "Shaved Ice", keywords: ["shaved ice", "snowcone"] },
  { emoji: "🍮", label: "Custard", keywords: ["custard", "flan", "pudding"] },
  { emoji: "🍯", label: "Honey", keywords: ["honey", "glaze"] },
  { emoji: "🍬", label: "Candy", keywords: ["candy", "sweet"] },
  { emoji: "🍭", label: "Lollipop", keywords: ["lollipop", "candy"] },
  { emoji: "🥧", label: "Pie", keywords: ["pie", "quiche"] },
  { emoji: "🍡", label: "Sweet Skewer", keywords: ["skewer", "dango"] },
  { emoji: "🥠", label: "Fortune Cookie", keywords: ["fortune cookie", "cookie"] },
  // Drinks
  { emoji: "☕️", label: "Coffee", keywords: ["coffee", "espresso"] },
  { emoji: "🍵", label: "Tea", keywords: ["tea", "matcha"] },
  { emoji: "🧋", label: "Bubble Tea", keywords: ["boba", "bubble tea", "tea"] },
  { emoji: "🧉", label: "Mate", keywords: ["mate", "tea", "drink"] },
  { emoji: "🥛", label: "Milk", keywords: ["milk", "smoothie", "shake", "latte"] },
  { emoji: "🧊", label: "Ice", keywords: ["ice", "cold", "drink"] },
  { emoji: "🥤", label: "Soda", keywords: ["soda", "soft drink"] },
  { emoji: "🧃", label: "Juice Box", keywords: ["juice", "box"] },
  { emoji: "🍺", label: "Beer", keywords: ["beer", "brat", "pub"] },
  { emoji: "🍻", label: "Beer Cheers", keywords: ["cheers", "beer"] },
  { emoji: "🍷", label: "Wine", keywords: ["wine", "charcuterie"] },
  { emoji: "🥂", label: "Champagne", keywords: ["celebration", "anniversary"] },
  { emoji: "🍾", label: "Sparkling", keywords: ["champagne"] },
  { emoji: "🍸", label: "Cocktail", keywords: ["cocktail", "martini"] },
  { emoji: "🍹", label: "Tropical Drink", keywords: ["tropical", "cocktail"] },
  { emoji: "🍶", label: "Sake", keywords: ["sake", "japanese", "drink"] },
  // Breakfast & spreads
  { emoji: "🥯", label: "Bagel Spread", keywords: ["bagel", "spread"] },
  { emoji: "🥨", label: "Snack Pretzel", keywords: ["pretzel", "snack"] },
  { emoji: "🍯", label: "Honey Pot", keywords: ["honey", "spread"] },
  { emoji: "🧈", label: "Butter", keywords: ["butter", "spread"] },
  { emoji: "🍯", label: "Jam", keywords: ["jam", "jelly"] },
  // Seasonings & extras
  { emoji: "🧂", label: "Seasoning", keywords: ["seasoning", "salt", "spice"] },
  { emoji: "🌭", label: "Sausage", keywords: ["sausage"] },
  { emoji: "🌶️", label: "Spice", keywords: ["spice", "hot"] },
  { emoji: "🫙", label: "Jar", keywords: ["jar", "sauce", "condiment"] },
  // Symbols & utensils
  { emoji: "🍴", label: "Fork and Knife", keywords: ["utensils", "meal"] },
  { emoji: "🥢", label: "Chopsticks", keywords: ["chopsticks", "utensils"] },
  { emoji: "🥄", label: "Spoon", keywords: ["spoon", "utensils"] },
  { emoji: "🍽️", label: "Plate", keywords: ["plate", "dinner"] },
  { emoji: "🧂", label: "Salt", keywords: ["salt", "seasoning"] },
  { emoji: "🪣", label: "Bucket", keywords: ["bucket", "ice bucket"] },
];

const uniqueCatalog = (() => {
  const seen = new Set<string>();
  return FOOD_AND_DRINK_CATALOG.filter((entry) => {
    if (seen.has(entry.emoji)) {
      return false;
    }
    seen.add(entry.emoji);
    return true;
  });
})();

export const EMOJI_CATALOG = uniqueCatalog;

export const findEmojiMatches = (query: string, limit = 360): EmojiCatalogEntry[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return EMOJI_CATALOG.slice(0, limit);
  }
  const results = EMOJI_CATALOG.filter((entry) => {
    if (entry.label.toLowerCase().includes(normalized)) {
      return true;
    }
    return entry.keywords.some((keyword) => keyword.includes(normalized));
  });
  return results.slice(0, limit);
};

export const suggestEmojiForTitle = (title: string): string | null => {
  const normalized = title.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const directMatch = EMOJI_CATALOG.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
  if (directMatch) {
    return directMatch.emoji;
  }
  const wordSet = new Set(normalized.split(/\s+/).filter(Boolean));
  for (const entry of EMOJI_CATALOG) {
    if (entry.keywords.some((keyword) => wordSet.has(keyword))) {
      return entry.emoji;
    }
  }
  return null;
};

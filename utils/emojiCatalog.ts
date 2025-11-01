export const DEFAULT_MEAL_EMOJI = "🍽️";

export type EmojiCatalogEntry = {
  emoji: string;
  label: string;
  keywords: string[];
};

const catalog: EmojiCatalogEntry[] = [
  { emoji: "🌮", label: "Taco", keywords: ["taco", "quesadilla", "mexican"] },
  { emoji: "🌯", label: "Burrito", keywords: ["burrito", "wrap"] },
  { emoji: "🥙", label: "Gyro", keywords: ["gyro", "pita", "shawarma", "falafel"] },
  { emoji: "🍕", label: "Pizza", keywords: ["pizza", "pepperoni", "margherita"] },
  { emoji: "🍔", label: "Burger", keywords: ["burger", "cheeseburger", "hamburger", "sliders"] },
  { emoji: "🌭", label: "Hot Dog", keywords: ["hotdog", "hot dog", "sausage", "brat"] },
  { emoji: "🥪", label: "Sandwich", keywords: ["sandwich", "sub", "panini", "blt"] },
  { emoji: "🍝", label: "Pasta", keywords: ["pasta", "spaghetti", "linguine", "lasagna"] },
  { emoji: "🦐", label: "Shrimp", keywords: ["shrimp", "prawns"] },
  { emoji: "🐟", label: "Fish", keywords: ["salmon", "fish", "cod", "halibut", "trout"] },
  { emoji: "🍣", label: "Sushi", keywords: ["sushi", "sashimi", "nigiri", "maki"] },
  { emoji: "🥡", label: "Stir Fry", keywords: ["stir fry", "lo mein", "takeout", "chinese"] },
  { emoji: "🥢", label: "Asian Cuisine", keywords: ["ramen", "pho", "noodles", "udon"] },
  { emoji: "🍜", label: "Soup", keywords: ["soup", "broth", "ramen", "pho", "stew", "chili"] },
  { emoji: "🍲", label: "Stew", keywords: ["stew", "curry", "gumbo"] },
  { emoji: "🥗", label: "Salad", keywords: ["salad", "greens", "caesar", "kale"] },
  { emoji: "🥬", label: "Vegetables", keywords: ["vegetable", "veggies", "broccoli", "asparagus", "greens"] },
  { emoji: "🥦", label: "Broccoli", keywords: ["broccoli"] },
  { emoji: "🥕", label: "Carrot", keywords: ["carrot", "root"] },
  { emoji: "🍗", label: "Chicken", keywords: ["chicken", "drumstick", "wings"] },
  { emoji: "🍖", label: "BBQ", keywords: ["bbq", "ribs", "steak", "brisket"] },
  { emoji: "🥩", label: "Steak", keywords: ["steak", "beef", "sirloin", "ribeye"] },
  { emoji: "🫘", label: "Beans", keywords: ["beans", "chili", "lentils"] },
  { emoji: "🥔", label: "Potato", keywords: ["potato", "fries", "mash", "baked potato"] },
  { emoji: "🍞", label: "Bread", keywords: ["bread", "toast", "baguette", "loaf"] },
  { emoji: "🥖", label: "Baguette", keywords: ["baguette", "french bread"] },
  { emoji: "🍛", label: "Curry", keywords: ["curry", "masala", "vindaloo"] },
  { emoji: "🍱", label: "Bento", keywords: ["bento", "japanese", "lunchbox"] },
  { emoji: "🥟", label: "Dumpling", keywords: ["dumpling", "potsticker", "pierogi"] },
  { emoji: "🍚", label: "Rice", keywords: ["rice", "fried rice", "pilaf"] },
  { emoji: "🍳", label: "Breakfast", keywords: ["breakfast", "eggs", "omelette", "brunch", "scramble"] },
  { emoji: "🥞", label: "Pancakes", keywords: ["pancake", "waffle", "crepe"] },
  { emoji: "🧇", label: "Waffles", keywords: ["waffle"] },
  { emoji: "🧀", label: "Cheese", keywords: ["cheese", "mac and cheese"] },
  { emoji: "🥧", label: "Pie", keywords: ["pie", "quiche"] },
  { emoji: "🧆", label: "Falafel", keywords: ["falafel", "mediterranean"] },
  { emoji: "🥫", label: "Canned", keywords: ["casserole", "chili", "soup"] },
  { emoji: "🥠", label: "Fortune Cookie", keywords: ["fortune cookie", "cookie"] },
  { emoji: "🍤", label: "Tempura", keywords: ["tempura"] },
  { emoji: "🍥", label: "Naruto", keywords: ["narutomaki"] },
  { emoji: "🍘", label: "Rice Cracker", keywords: ["rice cracker"] },
  { emoji: "🥣", label: "Bowl", keywords: ["bowl", "cereal", "porridge", "oatmeal"] },
  { emoji: "🍠", label: "Sweet Potato", keywords: ["sweet potato", "yam"] },
  { emoji: "🌰", label: "Nuts", keywords: ["nuts", "chestnut"] },
  { emoji: "🍨", label: "Ice Cream", keywords: ["ice cream", "dessert", "gelato"] },
  { emoji: "🍦", label: "Soft Serve", keywords: ["soft serve"] },
  { emoji: "🍧", label: "Shaved Ice", keywords: ["shaved ice", "snowcone"] },
  { emoji: "🍰", label: "Cake", keywords: ["cake", "birthday"] },
  { emoji: "🧁", label: "Cupcake", keywords: ["cupcake"] },
  { emoji: "🍩", label: "Donut", keywords: ["donut", "doughnut"] },
  { emoji: "🍪", label: "Cookie", keywords: ["cookie"] },
  { emoji: "🍫", label: "Chocolate", keywords: ["chocolate", "brownie"] },
  { emoji: "🍯", label: "Honey", keywords: ["honey", "glaze"] },
  { emoji: "🍓", label: "Strawberry", keywords: ["strawberry", "fruit", "berries"] },
  { emoji: "🍉", label: "Watermelon", keywords: ["watermelon"] },
  { emoji: "🍌", label: "Banana", keywords: ["banana"] },
  { emoji: "🍎", label: "Apple", keywords: ["apple", "cider"] },
  { emoji: "🍑", label: "Peach", keywords: ["peach"] },
  { emoji: "🍍", label: "Pineapple", keywords: ["pineapple", "hawaiian"] },
  { emoji: "🥝", label: "Kiwi", keywords: ["kiwi"] },
  { emoji: "🍇", label: "Grapes", keywords: ["grape"] },
  { emoji: "🍅", label: "Tomato", keywords: ["tomato", "caprese"] },
  { emoji: "🌶️", label: "Spicy", keywords: ["spicy", "pepper", "chili"] },
  { emoji: "🧄", label: "Garlic", keywords: ["garlic"] },
  { emoji: "🧅", label: "Onion", keywords: ["onion"] },
  { emoji: "🍄", label: "Mushroom", keywords: ["mushroom"] },
  { emoji: "🌽", label: "Corn", keywords: ["corn", "cob"] },
  { emoji: "🥐", label: "Croissant", keywords: ["croissant", "pastry"] },
  { emoji: "🍿", label: "Popcorn", keywords: ["popcorn", "movie"] },
  { emoji: "🧂", label: "Seasoning", keywords: ["seasoning", "salt", "spice"] },
  { emoji: "🥛", label: "Milk", keywords: ["milk", "smoothie", "shake", "latte"] },
  { emoji: "☕️", label: "Coffee", keywords: ["coffee", "espresso"] },
  { emoji: "🍵", label: "Tea", keywords: ["tea", "matcha"] },
  { emoji: "🍺", label: "Beer", keywords: ["beer", "brat", "pub"] },
  { emoji: "🍷", label: "Wine", keywords: ["wine", "charcuterie"] },
  { emoji: "🥂", label: "Celebration", keywords: ["celebration", "anniversary"] },
  { emoji: "🍾", label: "Champagne", keywords: ["champagne"] },
];

const uniqueCatalog = (() => {
  const seen = new Set<string>();
  return catalog.filter((entry) => {
    if (seen.has(entry.emoji)) {
      return false;
    }
    seen.add(entry.emoji);
    return true;
  });
})();

export const EMOJI_CATALOG = uniqueCatalog;

export const findEmojiMatches = (query: string, limit = 60): EmojiCatalogEntry[] => {
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

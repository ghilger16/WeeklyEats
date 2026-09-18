// Shared by the native app and Netlify. Exact identities only: no substring swaps.
const INGREDIENT_ALIASES = {
  "black beans": "Black Beans", "pinto beans": "Pinto Beans",
  "corn kernels": "Corn", corn: "Corn",
  "spring onions": "Green Onions", "spring onion": "Green Onions",
  scallions: "Green Onions", scallion: "Green Onions",
  "green onion": "Green Onions", "green onions": "Green Onions",
  "boneless skinless chicken breasts": "Chicken Breast",
  "boneless skinless chicken breast": "Chicken Breast",
  "skinless boneless chicken breasts": "Chicken Breast",
  "skinless boneless chicken breast": "Chicken Breast",
  "chicken breasts": "Chicken Breast",
  "chicken breast": "Chicken Breast",
  "boneless skinless chicken thighs": "Chicken Thigh",
  "chicken thighs": "Chicken Thigh",
  "chicken thigh": "Chicken Thigh",
  "yellow onion": "Onion", "yellow onions": "Onion",
  "white onion": "Onion", "white onions": "Onion", onions: "Onion", onion: "Onion",
  "extra virgin olive oil": "Olive Oil", "olive oil": "Olive Oil",
  "sharp cheddar cheese": "Cheddar Cheese", "sharp cheddar": "Cheddar Cheese",
  "shredded cheddar cheese": "Cheddar Cheese", "shredded cheddar": "Cheddar Cheese",
  "shredded sharp cheddar cheese": "Cheddar Cheese", "cheddar cheese": "Cheddar Cheese", cheddar: "Cheddar Cheese",
  "shredded mozzarella cheese": "Mozzarella Cheese", mozzarella: "Mozzarella Cheese",
  "mozzarella cheese": "Mozzarella Cheese",
  "grated parmesan cheese": "Parmesan Cheese", parmesan: "Parmesan Cheese", "parmesan cheese": "Parmesan Cheese",
  "parmesan reggiano": "Parmesan Cheese", "parmigiano reggiano": "Parmesan Cheese",
  "garlic cloves": "Garlic", "fresh garlic": "Garlic", garlic: "Garlic",
  "bell peppers": "Bell Pepper", "bell pepper": "Bell Pepper",
  "red bell peppers": "Red Bell Pepper", "green bell peppers": "Green Bell Pepper",
  tomatoes: "Tomato", carrots: "Carrot", potatoes: "Potato", eggs: "Egg",
  "large eggs": "Egg", "large egg": "Egg", "medium eggs": "Egg",
  "all purpose flour": "All-Purpose Flour",
};
const key = (name) => name.toLowerCase().replace(/[-,]/g, " ").replace(/\s+/g, " ").trim();
// Modifiers are removable only for these exact grocery identities. Unknown
// combinations stay intact (e.g. Fresh Pasta, Crushed Tomatoes, Packed Brown Sugar).
const produce = ["Onion", "Green Onions", "Red Onion", "Bell Pepper", "Red Bell Pepper", "Green Bell Pepper", "Yellow Bell Pepper", "Garlic", "Cilantro", "Parsley", "Basil", "Carrot", "Potato", "Corn"];
const cheeses = ["Cheddar Cheese", "Mozzarella Cheese", "Parmesan Cheese", "Mexican Cheese Blend"];
const beans = ["Black Beans", "Pinto Beans", "Kidney Beans", "Chickpeas"];
const modifierIdentities = {
  fresh: [...produce, ...beans], frozen: [...produce, ...beans],
  canned: [...beans, "Corn"], drained: [...beans, "Corn"], rinsed: [...beans, "Corn"],
  chopped: produce, diced: produce, sliced: [...produce, ...cheeses],
  minced: produce, shredded: [...produce, ...cheeses], grated: [...produce, ...cheeses],
  crushed: ["Garlic"], packed: ["Cilantro", "Parsley", "Basil"],
};
const titleCase = (name) => name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const stripSafeModifiers = (name) => {
  const modifiers = [];
  let remaining = name;
  let match;
  while ((match = remaining.match(/^(?:(?:finely|roughly|thinly|freshly)\s+)?(canned|frozen|fresh|shredded|grated|chopped|diced|sliced|minced|crushed|drained|rinsed|packed)\s+(.+)$/i))) {
    modifiers.push(match[1].toLowerCase());
    remaining = match[2];
  }
  const identity = INGREDIENT_ALIASES[key(remaining)] ?? titleCase(remaining);
  return modifiers.length && modifiers.every((modifier) => modifierIdentities[modifier].includes(identity))
    ? identity : name;
};
const basicSeasoning = /^(?:(?:fine|coarse|finely|coarsely|freshly|ground|cracked|fresh|iodized|iodised|kosher|sea|table|pink|himalayan|rock|black|white)\s+)*(?:salt|pepper|peppercorns?)$/i;
const cleanIngredientName = (raw) => {
  if (typeof raw !== "string") return "";
  const normalized = raw.normalize("NFKC").replace(/⁄/g, "/")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*[•*\-]\s*/, "").trim();
  const withoutQuantity = normalized.replace(/^\d+(?:[\d\s./–-]*\d)?\s+/, "");
  const withoutUnit = withoutQuantity !== normalized
    ? withoutQuantity.replace(/^(?:cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|packages?|sticks?|slices?|bunches?)\b\.?\s*/i, "")
    : normalized;
  return withoutUnit.replace(/^of\s+/i, "")
    .replace(/,\s*(?:chopped|diced|minced|sliced|grated|shredded|divided|melted|softened|drained|rinsed|to taste|as needed|or to taste)\b.*$/i, "")
    .replace(/\s+(?:to taste|as needed)$/i, "")
    .replace(/\s+/g, " ").trim();
};
const isBasicSaltOrPepper = (raw) => {
  const name = cleanIngredientName(raw);
  const parts = name.split(/\s+(?:and|&)\s+/i);
  return parts.length > 0 && parts.every((part) => basicSeasoning.test(part));
};
const canonicalIngredientName = (raw) => {
  const cleaned = cleanIngredientName(raw);
  if (!cleaned || isBasicSaltOrPepper(cleaned)) return "";
  const safeName = stripSafeModifiers(cleaned);
  return INGREDIENT_ALIASES[key(safeName)] ?? titleCase(safeName);
};
const normalizeIngredientNames = (ingredients) => {
  const seen = new Set();
  return (Array.isArray(ingredients) ? ingredients : []).flatMap((item) => {
    const raw = typeof item === "string" ? { name: item } : item;
    const name = canonicalIngredientName(raw?.name);
    if (!name || seen.has(key(name))) return [];
    seen.add(key(name));
    return [{ ...raw, name }];
  });
};
module.exports = { INGREDIENT_ALIASES, cleanIngredientName, canonicalIngredientName, isBasicSaltOrPepper, normalizeIngredientNames };

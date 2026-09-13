const { parse } = require("parse5");
const MAX_SOURCE_INGREDIENTS = 100;
const children = (node) => node.childNodes ?? [];
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value ?? "";
const text = (node) => node.nodeName === "#text" ? node.value : children(node).map(text).join(" ");
const plain = (value) => typeof value === "string" ? text(parse(value)).replace(/\s+/g, " ").trim() : "";
const walk = (node, visit) => { visit(node); children(node).forEach((child) => walk(child, visit)); };
const instructionText = (value) => {
  if (typeof value === "string") return plain(value);
  if (Array.isArray(value)) return value.map(instructionText).filter(Boolean).join("\n");
  if (value && typeof value === "object") return [plain(value.name), plain(value.text), instructionText(value.itemListElement)].filter(Boolean).join("\n");
  return "";
};
const typeIsRecipe = (value) => (Array.isArray(value) ? value : [value]).some((type) =>
  typeof type === "string" && /^(?:https?:\/\/schema\.org\/)?Recipe$/i.test(type));
const strings = (value) => (Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item.trim()).map(plain);
const sameUrl = (a, b) => {
  try { const left = new URL(a, b); const right = new URL(b); return left.origin === right.origin && left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, ""); } catch { return false; }
};

const extractRecipeSource = (html, url) => {
  const document = parse(html);
  const recipes = [];
  let jsonLdFound = false;
  let jsonLdParseErrors = 0;
  const scan = (value, isMain = false) => {
    if (Array.isArray(value)) { value.forEach((entry) => scan(entry, isMain)); return; }
    if (!value || typeof value !== "object") return;
    if (typeIsRecipe(value["@type"])) recipes.push({ value, isMain });
    Object.entries(value).forEach(([key, child]) => { if (child && typeof child === "object") scan(child, key === "mainEntity"); });
  };
  walk(document, (node) => {
    if (node.tagName !== "script" || attr(node, "type").toLowerCase().split(";")[0].trim() !== "application/ld+json") return;
    jsonLdFound = true;
    const raw = text(node).trim().replace(/^<!--|-->$/g, "");
    try { scan(JSON.parse(raw)); } catch {
      // A few publishers HTML-encode JSON inside script tags.
      try { scan(JSON.parse(plain(raw))); } catch { jsonLdParseErrors += 1; }
    }
  });
  const candidates = recipes.filter(({ value }) => strings(value.recipeIngredient).length);
  const matched = candidates.filter(({ value, isMain }) => isMain || sameUrl(value.url || value["@id"], url));
  const picked = matched[0] ?? (candidates.length === 1 ? candidates[0] : null);
  const visibleParts = [];
  const visibleText = (node) => {
    if (["script", "style", "noscript", "nav", "footer"].includes(node.tagName)) return;
    if (node.nodeName === "#text") visibleParts.push(node.value);
    children(node).forEach(visibleText);
  };
  visibleText(document);
  const visible = visibleParts.join(" ").replace(/\s+/g, " ").trim();
  const challenge = /(?:enable javascript and cookies to continue|verify (?:that )?you are human|checking your browser|access denied|request blocked|unusual traffic|just a moment|captcha challenge)/i.test(visible) || /(?:window\._cf_chl_opt|id=["']challenge-error-text|cf-chl-)/i.test(html);
  const diagnostics = {
    jsonLdFound, jsonLdParseErrors, recipeSchemaFound: recipes.length > 0,
    recipeIngredientFound: candidates.length > 0, appearsBlocked: challenge,
    recipeCandidates: candidates.length,
  };
  if (picked) {
    const recipe = picked.value;
    const ingredients = strings(recipe.recipeIngredient);
    if (ingredients.length > MAX_SOURCE_INGREDIENTS || ingredients.some((item) => item.length > 1000)) return { diagnostics, error: "Recipe ingredient source exceeds import limits." };
    return { diagnostics, source: {
      kind: "json-ld", name: plain(recipe.name), ingredients,
      instructions: instructionText(recipe.recipeInstructions).slice(0, 12000),
      cuisine: recipe.recipeCuisine, category: recipe.recipeCategory, yield: recipe.recipeYield,
    } };
  }
  if (challenge) return { diagnostics, error: "Recipe request appears to have been blocked by host." };
  if (candidates.length > 1) return { diagnostics, error: "Multiple recipes found without an identifiable main recipe." };

  // Standards-based microdata first; otherwise a bounded Ingredients heading
  // section. Never send the first N characters of an unrelated article.
  const ingredients = [];
  let instructions = "";
  walk(document, (node) => {
    if (attr(node, "itemprop").split(/\s+/).includes("recipeInstructions")) instructions += plain(text(node)) + "\n";
    if (attr(node, "itemprop").split(/\s+/).includes("recipeIngredient")) {
      const value = plain(attr(node, "content") || text(node));
      if (value) ingredients.push(value);
    }
  });
  if (!ingredients.length) {
    const lines = [];
    const blockTags = new Set(["h1", "h2", "h3", "h4", "li", "p", "div", "br"]);
    const visit = (node) => {
      if (["script", "style", "noscript", "nav", "footer"].includes(node.tagName)) return;
      if (node.tagName === "li") {
        lines.push(`\n__LIST_ITEM__${plain(text(node))}\n`);
        return;
      }
      if (blockTags.has(node.tagName)) lines.push("\n");
      if (node.nodeName === "#text") lines.push(node.value);
      children(node).forEach(visit);
      if (blockTags.has(node.tagName)) lines.push("\n");
    };
    visit(document);
    const rows = lines.join(" ").split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const instructionStart = rows.findIndex((line) => /^(?:directions|instructions|method|preparation)\s*:?$/i.test(line));
    if (instructionStart >= 0) {
      const instructionRows = [];
      for (const line of rows.slice(instructionStart + 1)) {
        if (/^(?:nutrition|reviews|comments|related recipes)\b/i.test(line)) break;
        instructionRows.push(line.replace(/^__LIST_ITEM__/, ""));
      }
      instructions = instructionRows.join("\n").slice(0, 12000);
    }
    const start = rows.findIndex((line) => /^(?:recipe )?ingredients\s*:?$/i.test(line));
    if (start >= 0) {
      for (const row of rows.slice(start + 1)) {
        const line = row.replace(/^__LIST_ITEM__/, "");
        if (/^(?:directions|instructions|method|preparation|nutrition|reviews|how to make)\b/i.test(line)) break;
        if (row.startsWith("__LIST_ITEM__") || /^\d|^[¼½¾⅓⅔⅛⅜⅝⅞]|^(?:a |an )?(?:pinch|dash|handful)\b/i.test(line)) ingredients.push(line);
        else if (/^(?:to serve|for serving|serving suggestions|optional garnish|garnish|recommended sides|suggested accompaniments)\s*:?$/i.test(line)) break;
        if (ingredients.length > MAX_SOURCE_INGREDIENTS) break;
      }
    }
  }
  if (!ingredients.length || ingredients.length > MAX_SOURCE_INGREDIENTS || ingredients.some((item) => item.length > 1000)) {
    return { diagnostics, error: "Recipe page fetched but no structured or usable ingredient data found." };
  }
  let title = "";
  walk(document, (node) => { if (!title && node.tagName === "h1") title = plain(text(node)); });
  return { diagnostics, source: { kind: "ingredient-section", name: title, ingredients, instructions: instructions.slice(0, 12000) } };
};
module.exports = { extractRecipeSource };

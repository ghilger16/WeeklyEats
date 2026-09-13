export const INGREDIENT_ALIASES: Record<string, string>;
export function cleanIngredientName(raw: unknown): string;
export function canonicalIngredientName(raw: unknown): string;
export function isBasicSaltOrPepper(raw: unknown): boolean;
export function normalizeIngredientNames<T extends { name: string }>(ingredients: T[]): T[];

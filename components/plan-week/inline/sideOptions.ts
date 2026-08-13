import { Meal } from "../../../types/meals";

export type SideOption = {
  name: string;
  isCustom: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const promoteSavedSides = (
  savedSides: string[],
  suggestedSides: string[] = [],
): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  [...savedSides, ...suggestedSides].forEach((name) => {
    if (typeof name !== "string" || next.length >= 6) return;
    const trimmed = name.trim();
    const key = normalize(trimmed);
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    next.push(trimmed);
  });
  return next;
};

export const getSideOptionsForMeal = (
  meal: Meal,
  existingSides: string[] = [],
): SideOption[] => {
  const seen = new Set<string>();
  const options: SideOption[] = [];
  const suggestedSides = Array.isArray(meal.suggestedSides)
    ? meal.suggestedSides
    : [];
  const suggestedSideKeys = new Set(suggestedSides.map(normalize));

  [...existingSides, ...suggestedSides].forEach((name) => {
    if (typeof name !== "string") return;
    const trimmed = name.trim();
    const key = normalize(trimmed);
    if (!trimmed || seen.has(key) || options.length >= 6) return;
    seen.add(key);
    options.push({ name: trimmed, isCustom: !suggestedSideKeys.has(key) });
  });

  return options;
};

export const replaceSideWithCustomOption = (
  options: SideOption[],
  selectedSides: string[],
  customSide: string,
): { options: SideOption[]; selectedSides: string[] } | null => {
  const trimmed = customSide.trim();
  const customKey = normalize(trimmed);
  if (!trimmed || options.some((option) => normalize(option.name) === customKey)) {
    return null;
  }

  const nextOptions = [
    { name: trimmed, isCustom: true },
    ...options,
  ].slice(0, 6);
  const visibleKeys = new Set(nextOptions.map((option) => normalize(option.name)));
  const nextSelectedSides = [
      ...selectedSides.filter((side) => visibleKeys.has(normalize(side))),
      trimmed,
    ];
  return {
    options: nextOptions,
    selectedSides: nextSelectedSides,
  };
};

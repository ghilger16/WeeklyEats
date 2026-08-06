import { Meal } from "../../../types/meals";

export type SideOption = {
  name: string;
  isCustom: boolean;
};

export const DEFAULT_SIDE_OPTIONS = [
  "Salad",
  "Rice",
  "Roasted Vegetables",
  "Bread",
  "Potatoes",
  "Fresh Fruit",
];

const normalize = (value: string) => value.trim().toLowerCase();
const defaultSideKeys = new Set(DEFAULT_SIDE_OPTIONS.map(normalize));

export const getSideOptionsForMeal = (
  _meal: Meal,
  existingSides: string[] = [],
): SideOption[] => {
  const seen = new Set<string>();
  const options: SideOption[] = [];

  const uniqueExistingSides = existingSides.filter((name, index, values) => {
    const key = normalize(name);
    return Boolean(key) && values.findIndex((value) => normalize(value) === key) === index;
  });
  const customSides = uniqueExistingSides.filter(
    (name) => !defaultSideKeys.has(normalize(name)),
  );
  const standardSides = uniqueExistingSides.filter((name) =>
    defaultSideKeys.has(normalize(name)),
  );

  [...customSides, ...standardSides, ...DEFAULT_SIDE_OPTIONS].forEach((name) => {
    const trimmed = name.trim();
    const key = normalize(trimmed);
    if (!trimmed || seen.has(key) || options.length >= 6) return;
    seen.add(key);
    options.push({ name: trimmed, isCustom: !defaultSideKeys.has(key) });
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

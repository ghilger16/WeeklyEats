import {
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "./weekPlan";

export type MoodOption = "low_effort" | "motivated" | "family_favorite";
export type EffortOption =
  | "easy"
  | "medium"
  | "hard"
  | "easy_medium"
  | "medium_hard";
export type ExpenseOption = "$" | "$$" | "$$$";
export type ReuseOption = 1 | 2 | 3 | 4;
export type PinInclusion = "include" | "exclude";

export const MEAL_TYPE_OPTIONS = [
  { id: "pasta", label: "Pasta", emoji: "🍝" },
  { id: "soup", label: "Soup", emoji: "🥣" },
  { id: "tacos", label: "Tacos", emoji: "🌮" },
  { id: "salad", label: "Salad", emoji: "🥗" },
  { id: "one_pot", label: "One-Pot", emoji: "🥘" },
] as const;

export type MealTypeOption = (typeof MEAL_TYPE_OPTIONS)[number]["id"];

export const MOOD_OPTIONS = [
  {
    id: "low_effort",
    label: "Low Effort",
    emoji: "🌙",
    effort: "easy_medium" as EffortOption,
  },
  {
    id: "motivated",
    label: "Motivated",
    emoji: "🔥",
    effort: "medium_hard" as EffortOption,
  },
  {
    id: "family_favorite",
    label: "Family Favorite",
    emoji: "❤️",
    familyStar: "include" as PinInclusion,
  },
] as const;

export type DayPinsState = {
  mood: MoodOption | null;
  moodMode: PinInclusion | null;
  effort: EffortOption | null;
  types: MealTypeOption[];
  excludedTypes: MealTypeOption[];
  expense: ExpenseOption | null;
  reuseWeeks: ReuseOption | null;
  freezerNight: boolean;
  familyStar: PinInclusion | null;
  completed: boolean;
};

export const createEmptyDayPinsState = (): DayPinsState => ({
  mood: null,
  moodMode: null,
  effort: null,
  types: [],
  excludedTypes: [],
  expense: null,
  reuseWeeks: null,
  freezerNight: false,
  familyStar: null,
  completed: false,
});

const VALID_EFFORT_VALUES: EffortOption[] = [
  "easy",
  "medium",
  "hard",
  "easy_medium",
  "medium_hard",
];

type LegacyEffortOption = EffortOption | "motivated";

const normalizeEffortValue = (
  value: LegacyEffortOption | null | undefined
): EffortOption | null => {
  if (!value) {
    return null;
  }
  if (value === "motivated") {
    return "medium_hard";
  }
  if ((VALID_EFFORT_VALUES as string[]).includes(value)) {
    return value as EffortOption;
  }
  return null;
};

export const normalizeDayPinsState = (
  state?: Partial<DayPinsState>
): DayPinsState => ({
  ...createEmptyDayPinsState(),
  ...state,
  effort: normalizeEffortValue(
    (state?.effort as LegacyEffortOption | null | undefined) ?? null
  ),
  types: Array.isArray(state?.types) ? [...(state?.types ?? [])] : [],
  excludedTypes: Array.isArray(state?.excludedTypes)
    ? [...(state?.excludedTypes ?? [])]
    : [],
  freezerNight: Boolean(state?.freezerNight),
  completed: Boolean(state?.completed),
});

export const moodLabelMap: Record<MoodOption, string> = {
  low_effort: "Low Effort",
  motivated: "Motivated",
  family_favorite: "Family Favorite",
};

export const effortLabelMap: Record<EffortOption, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  easy_medium: "Easy + Medium",
  medium_hard: "Medium + Hard",
};

export const expenseLabelMap: Record<ExpenseOption, string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
};

export const reuseLabelMap: Record<ReuseOption, string> = {
  1: "1W",
  2: "2W",
  3: "3W",
  4: "4W",
};

export const cycleInclusion = (current: PinInclusion | null): PinInclusion | null => {
  if (!current) {
    return "include";
  }
  if (current === "include") {
    return "exclude";
  }
  return null;
};

export const cycleArrayInclusion = (
  items: MealTypeOption[],
  excluded: MealTypeOption[],
  target: MealTypeOption
): { include: MealTypeOption[]; exclude: MealTypeOption[] } => {
  const isIncluded = items.includes(target);
  const isExcluded = excluded.includes(target);

  if (isIncluded) {
    return {
      include: items.filter((item) => item !== target),
      exclude: [...excluded, target],
    };
  }

  if (isExcluded) {
    return {
      include: items,
      exclude: excluded.filter((item) => item !== target),
    };
  }

  return {
    include: [...items, target],
    exclude: excluded,
  };
};

export const hasAnyPins = (state: DayPinsState): boolean =>
  Boolean(
    state.mood ||
      state.effort ||
      state.types.length ||
      state.excludedTypes.length ||
      state.expense ||
      state.reuseWeeks ||
      state.freezerNight ||
      state.familyStar
  );

export type DayPinsPerWeek = Record<PlannedWeekDayKey, DayPinsState>;

export const createEmptyDayPinsMap = (): DayPinsPerWeek =>
  PLANNED_WEEK_ORDER.reduce<DayPinsPerWeek>((acc, key) => {
    acc[key] = createEmptyDayPinsState();
    return acc;
  }, {} as DayPinsPerWeek);

export type SuggestionBannerContext =
  | "difficulty"
  | "reuse"
  | "freezer"
  | "favorite"
  | "general";

export type SuggestionBannerOptions = {
  context?: SuggestionBannerContext | string;
  subcontext?: "easy" | "motivated";
  onShow?: (message: string) => void;
};

type MessageMap = Record<SuggestionBannerContext, readonly string[]>;

const difficultyMessages = [
  "Keeping it easy tonight 💤",
  "Low effort, high flavor 👌",
  "You’re in motivated mode — nice pick 🔥",
] as const;

const reuseMessages = [
  "Haven’t had this in a while 👀",
  "Making a comeback 🕺",
  "Time for a repeat performance 🎬",
] as const;

const freezerMessages = [
  "Straight from the freezer — zero prep 🧊",
  "Already made, already winning 🏆",
] as const;

const favoriteMessages = [
  "A Family Star pick ⭐",
  "Everyone loved this one ❤️",
] as const;

const fallbackMessages = [
  "Here’s a fresh pick for you.",
  "New idea, same smart plan.",
] as const;

export const SUGGESTION_MESSAGE_MAP: MessageMap = {
  difficulty: difficultyMessages,
  reuse: reuseMessages,
  freezer: freezerMessages,
  favorite: favoriteMessages,
  general: [
    ...fallbackMessages,
    ...difficultyMessages,
    ...reuseMessages,
    ...freezerMessages,
    ...favoriteMessages,
  ],
};

const lastIndexByContext: Partial<Record<SuggestionBannerContext, number>> = {};

const selectMessage = (
  context: SuggestionBannerContext
): { message: string; context: SuggestionBannerContext } => {
  const pool = SUGGESTION_MESSAGE_MAP[context] ?? SUGGESTION_MESSAGE_MAP.general;
  if (!pool.length) {
    return { message: "Here’s a fresh pick for you.", context: "general" };
  }
  const lastIndex = lastIndexByContext[context];
  let nextIndex: number;
  if (pool.length === 1) {
    nextIndex = 0;
  } else {
    do {
      nextIndex = Math.floor(Math.random() * pool.length);
    } while (nextIndex === lastIndex);
  }
  lastIndexByContext[context] = nextIndex;
  return { message: pool[nextIndex], context };
};

const normalizeContext = (
  context?: SuggestionBannerContext | string
): SuggestionBannerContext => {
  if (!context) {
    return "general";
  }
  if (
    context === "difficulty" ||
    context === "reuse" ||
    context === "freezer" ||
    context === "favorite" ||
    context === "general"
  ) {
    return context;
  }
  return "general";
};

export const getSuggestionBanner = (
  options: SuggestionBannerOptions = {}
): { message: string; context: SuggestionBannerContext } => {
  const normalizedContext = normalizeContext(options.context);
  const result = selectMessage(normalizedContext);
  options.onShow?.(result.message);
  return result;
};

export const resetSuggestionBannerHistory = () => {
  Object.keys(lastIndexByContext).forEach((key) => {
    delete lastIndexByContext[key as SuggestionBannerContext];
  });
};

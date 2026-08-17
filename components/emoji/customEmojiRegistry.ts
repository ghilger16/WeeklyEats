export const CHILI_EMOJI_TOKEN = "custom:chili-bowl" as const;
export const PIGS_IN_A_BLANKET_EMOJI_TOKEN =
  "custom:pigs-in-a-blanket" as const;
export const MEATLOAF_EMOJI_TOKEN = "custom:meatloaf" as const;
export const MAC_AND_CHEESE_EMOJI_TOKEN = "custom:mac-and-cheese" as const;
export const BEEF_STIR_FRY_EMOJI_TOKEN = "custom:beef-stir-fry" as const;

export type CustomEmojiToken =
  | typeof CHILI_EMOJI_TOKEN
  | typeof PIGS_IN_A_BLANKET_EMOJI_TOKEN
  | typeof MEATLOAF_EMOJI_TOKEN
  | typeof MAC_AND_CHEESE_EMOJI_TOKEN
  | typeof BEEF_STIR_FRY_EMOJI_TOKEN;

export const CUSTOM_EMOJI_SOURCES: Readonly<Record<CustomEmojiToken, number>> =
  Object.freeze({
    [CHILI_EMOJI_TOKEN]: require("../../assets/emoji/chili-bowl.png"),
    [PIGS_IN_A_BLANKET_EMOJI_TOKEN]: require("../../assets/emoji/pigs-in-a-blanket.png"),
    [MEATLOAF_EMOJI_TOKEN]: require("../../assets/emoji/meatloaf.png"),
    [MAC_AND_CHEESE_EMOJI_TOKEN]: require("../../assets/emoji/mac-and-cheese.png"),
    [BEEF_STIR_FRY_EMOJI_TOKEN]: require("../../assets/emoji/beef-stir-fry.png"),
  });

export const CUSTOM_EMOJI_ASSETS = Object.freeze(
  Object.values(CUSTOM_EMOJI_SOURCES),
);

export const getCustomEmojiSource = (value?: string | null) =>
  value && value in CUSTOM_EMOJI_SOURCES
    ? CUSTOM_EMOJI_SOURCES[value as CustomEmojiToken]
    : undefined;

export const isCustomEmojiToken = (
  value?: string | null,
): value is CustomEmojiToken => Boolean(getCustomEmojiSource(value));

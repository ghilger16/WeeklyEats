import {
  SUGGESTION_MESSAGE_MAP,
  SuggestionBannerContext,
  getSuggestionBanner,
  resetSuggestionBannerHistory,
} from "../components/plan-week/suggestions/suggestionBanners";

describe("getSuggestionBanner", () => {
  beforeEach(() => {
    resetSuggestionBannerHistory();
  });

  const contexts: SuggestionBannerContext[] = [
    "difficulty",
    "reuse",
    "freezer",
    "favorite",
    "general",
  ];

  contexts.forEach((context) => {
    it(`returns a message for context "${context}"`, () => {
      const { message } = getSuggestionBanner({ context });
      expect(SUGGESTION_MESSAGE_MAP[context]).toContain(message);
    });
  });

  it("falls back to general pool when context is missing", () => {
    const { message } = getSuggestionBanner();
    expect(SUGGESTION_MESSAGE_MAP.general).toContain(message);
  });

  it("does not repeat the same message twice in a row for the same context", () => {
    const context: SuggestionBannerContext = "difficulty";
    const first = getSuggestionBanner({ context }).message;
    const second = getSuggestionBanner({ context }).message;
    if (SUGGESTION_MESSAGE_MAP[context].length > 1) {
      expect(second).not.toBe(first);
    } else {
      expect(second).toBe(first);
    }
  });
});

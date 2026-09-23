# Plan It for Me: implementation report

The planner fills empty days in the current planning session, in shopping-day order. Existing assignments remain intact. Candidate eligibility is decided before scoring; no match leaves a day empty. The planner uses saved meals and actual serving history, without a network or AI dependency.

## Updated scoring

| Signal | Contribution |
| --- | --- |
| Excluded meal type, excluded favorites, duplicate meal | Ineligible |
| Freezer night | Requires a full freezer meal; +40 |
| Freezer inventory without a freezer-night setting | +5 |
| Explicit favorite preference | +30 for a favorite, −25 otherwise |
| Favorite without that preference | +5 |
| Explicit effort | Filters eligible difficulty levels; +25 for a match |
| Preferred meal type | +15 once, even if multiple preferred types match |
| Repeat timing | +20 when never served or outside the selected interval; −25 when served within it |
| Family ratings | Average of Loved +12, Liked +6, Not A Fan −12; unrecorded/zero ratings are ignored |
| Legacy overall rating, if individual ratings are absent | `(rating − 3) × 6`, bounded to −12…+12; zero/unrated is neutral |
| Never served | +14 |
| Previously served | `min(daysSinceLastServed / 14, 12)` |
| Weekday cuisine affinity | 0…+8 |
| Meaningful shared ingredients | +1 per unique shared ingredient, capped at +4 |
| Expense preference | Exact tier +10; one tier away +3; two tiers away −5 |
| Meal generated in an earlier attempt | −30 |
| Randomness | Resolves exact score ties only |

The existing freezer-night behavior is retained: effort and expense filters are bypassed on freezer nights, while their scoring still applies. A freezer meal outside an explicit effort preference receives the existing −15 effort adjustment. Type exclusions and favorite exclusions still apply. Normal effort filtering distinguishes Easy (difficulty ≤2), Medium (3 or missing), and Hard (≥4). There is no default easy-meal bonus based on position in the week.

Family Star/favorite meanings elsewhere in the app are unchanged. The planner averages recorded individual ratings; it does not infer a dislike for household members who have not rated a meal. The old extra unanimous-family bonus and separate overall-rating contribution are replaced by one bounded rating contribution.

## Serving history and repeat timing

`getLatestServedDates` is the shared source for repeat timing and general recency. It considers only entries with `outcome === "served"`, a meal ID, and a valid nonfuture timestamp. It selects the latest actual serving for each meal. Editing a meal has no effect. Missing serving history means never served. The inspiration selector also reuses this extraction helper.

Planner suggestions, the dashboard suggestion pool, and pin-filtered search now receive their available serving history. Repeat timing remains a strong scoring preference, not a hard exclusion, matching the existing behavior.

## Weekday cuisine affinity

For the requested weekday, take at most the last eight distinct logged dates from the preceding 56 days. Only actual served entries count. Duplicate logs on the same local calendar date count once; the newest entry wins.

Each occurrence has weight:

`weight = 2 ^ (−ageInDays / 28)`

This gives a four-week half-life. Compute the total weight across the weekday's occurrences and the matching-cuisine weight. Then:

`affinity = min(8, 2.5 × matchingWeight × matchingWeight / totalWeight)`

A single recent match earns less than 2.5 points. Several consistent recent matches earn a stronger bonus. Mixed history has lower confidence; old history fades and anything older than eight weeks is ignored. Unknown cuisine/deleted meals dilute confidence rather than being guessed. “Other” is not treated as a learned cuisine preference.

The serving log contains no historical cuisine snapshot. The calculation uses each served meal's current saved cuisine and the log's recorded `dayKey`. Changing a meal's cuisine therefore changes how its past servings are interpreted. No separate cuisine-history store was added.

## Ingredient reuse

The planner reuses `getIngredientOverlap`, including canonical ingredient names, plural normalization, deduplication, and pantry classification. Object ingredients marked as pantry staples do not count; legacy string ingredients use the existing default-pantry list. A shared ingredient counts once across the entire already-planned meal set, not once per matching meal. The bonus cannot exceed +4.

## Meal types

The current Meal model has no stored meal-type tags, and there was no existing matching implementation. A shared title matcher now recognizes the five existing settings: Pasta, Soup, Tacos, Salad, and One-Pot. Pasta includes common pasta names; Soup includes soup/stew/chowder/bisque; One-Pot also recognizes One-Pan. Matching is case-insensitive and word-based.

Explicit exclusions remove matches, including hybrid titles such as Taco Pasta. Preferred types earn +15. All suggestion consumers use the same matcher. This is intentionally title-based: an ambiguously named meal cannot reliably be classified without stored type data. Cuisine is not used as a substitute for meal type.

## Ties, retry, and whole-week evaluation

Candidate meals sort by score, then an independently drawn random value for exact ties. Higher scores cannot lose because of randomness. The RNG and reference time are injectable for deterministic tests. There was no planning attempt counter or seeded session ID, so production uses `Math.random` only for tie resolution.

Each call creates three candidates using the existing greedy day-by-day algorithm. The result filling the most days wins first. Among equally complete candidates, compare total meal scores minus a small whole-week penalty:

- Each occurrence of a cuisine beyond three: −2.
- Each hard meal beyond two, on days without explicit effort settings: −2.
- Each expensive meal beyond two, on days without explicit expense settings: −1.
- Combined whole-week penalty capped at 8.

Existing planned meals are included in that evaluation and never changed. This is a lightweight comparison, not a global optimizer: alternatives arise only where meal scores tie. It never relaxes filters. Preferred ingredient overlap is already part of candidate scores. Side optimization is deliberately excluded.

“Try Another” retains the −30 penalty for previously generated meal IDs. Each returned assignment contains an inspectable score breakdown: settings, rating, repeat timing, recency, weekday cuisine, ingredient overlap, previous-attempt penalty, and total. These values are not shown in the UI.

## Sides

Initial generation still uses the first nonempty preferred side only when the day has no manual selection. Retry bookkeeping tracks the sides it assigned so manual changes—including deliberately removing every side—remain intact through repeated retries. It does not optimize sides.

## Files changed for auto-planning

- `components/plan-week/autoPlan.ts`: candidate selection, tie handling, score breakdown, whole-week comparison.
- `components/plan-week/autoPlanScoring.ts`: recency, ingredient, cuisine, and week-level scoring.
- `components/plan-week/autoPlanSides.ts`: side-selection ownership across retries.
- `components/plan-week/suggestions/suggestionMatcher.ts`: shared filtering, repeat timing, type preferences, and rating contribution.
- `utils/servingHistory.ts`: shared actual-serving extraction and repeat score.
- `utils/mealTypes.ts`: shared title-based type recognition.
- `utils/familyRatings.ts`: proportional planner rating contribution.
- `components/plan-week/inspirationSelectors.ts`: reuse serving-history extraction.
- `app/modals/plan-week.tsx`: history wiring and side-preserving retry integration.
- `app/(tabs)/week-dashboard/index.tsx`: history wiring for suggestions.
- `components/plan-week/suggestions/SuggestMealModal.tsx`: history-aware pin filtering and active type settings.
- `components/meals/MealSearchModal.tsx`: history-aware pin filtering and active type settings.
- `__tests__/autoPlan.test.ts`: native storage mock for reused ingredient helpers.
- `__tests__/autoPlanScoring.test.ts`: 28 cases covering the requested scenarios and related edge cases.

## Quick Picks follow-up

Planned day drawers include Swap. Selecting it collapses the drawer and reuses the main Choose a day layout in shopping-day order. The source day is disabled and marked Current. Other days show Move when empty and Swap when occupied. Cancel or the modal close button exits selection without changing the plan. Selecting a destination moves or exchanges the dinners, including sides and special-meal titles. Day-specific pins stay with their calendar days. Normal draft persistence handles the change.

Additional files: `components/plan-week/inline/InlineDaySearch.tsx`, `utils/swapPlannedDays.ts`, `__tests__/inlineDaySwap.test.tsx`, and `__tests__/swapPlannedDays.test.ts`; integration is in `app/modals/plan-week.tsx`.

## Validation

Final run: 38 test suites passed, 295 tests passed. The existing MealsScreen suite still fails during setup because Jest cannot load `expo-haptics`. Type checking reports three pre-existing errors in DayPlannedToast, PlanDayChoiceStep, and the theme types; the suggestion matcher's nullable expense error was fixed. `git diff --check` passes. Browser automation was unavailable for visual verification.

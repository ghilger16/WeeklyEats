export const CELEBRATION_MESSAGES = [
  "Dinner goals unlocked! Keep the streak going.",
  "Chef’s kiss! Your future self thanks you.",
  "Apron legend. The kitchen is proud of you.",
  "Meal mastered. Enjoy the victory bites!",
  "Look at you, crushing dinner like a pro.",
] as const;

export const EAT_OUT_CELEBRATION_MESSAGES = [
  "Eat out night served. Enjoy the break!",
  "No dishes tonight. That counts as a win.",
  "Dinner out, plan complete.",
  "Chef’s night off marked served.",
  "A night out well planned.",
] as const;

export type EatOutCompletionMessage = {
  icon: string;
  title: string;
  subtitle: string;
};

const EAT_OUT_COMPLETION_MESSAGES: EatOutCompletionMessage[] = [
  {
    icon: "🍽",
    title: "NIGHT OUT",
    subtitle: "Enjoy your night off from cooking.",
  },
  {
    icon: "🌟",
    title: "PLANS COMPLETE",
    subtitle: "Eat out night completed.",
  },
  {
    icon: "🍔",
    title: "ATE OUT",
    subtitle: "Hope it was delicious!",
  },
  {
    icon: "🥡",
    title: "TAKEOUT VICTORY",
    subtitle: "Dinner handled.",
  },
  {
    icon: "🍽",
    title: "DINNER OUT",
    subtitle: "One less thing to worry about tonight.",
  },
  {
    icon: "✨",
    title: "NIGHT OFF",
    subtitle: "No cooking required.",
  },
  {
    icon: "🎉",
    title: "DINNER DONE",
    subtitle: "Whether cooked or ordered, dinner is handled.",
  },
  {
    icon: "🍴",
    title: "ENJOYED THE EVENING",
    subtitle: "Another successful dinner plan.",
  },
];

export const getRandomCelebrationMessage = () =>
  CELEBRATION_MESSAGES[
    Math.floor(Math.random() * CELEBRATION_MESSAGES.length)
  ];

export const getRandomEatOutCelebrationMessage = () =>
  EAT_OUT_CELEBRATION_MESSAGES[
    Math.floor(Math.random() * EAT_OUT_CELEBRATION_MESSAGES.length)
  ];

export const getEatOutCompletionMessage = () =>
  EAT_OUT_COMPLETION_MESSAGES[
    Math.floor(Math.random() * EAT_OUT_COMPLETION_MESSAGES.length)
  ];

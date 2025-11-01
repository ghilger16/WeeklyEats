export const CELEBRATION_MESSAGES = [
  "Dinner goals unlocked! Keep the streak going.",
  "Chef’s kiss! Your future self thanks you.",
  "Apron legend. The kitchen is proud of you.",
  "Meal mastered. Enjoy the victory bites!",
  "Look at you, crushing dinner like a pro.",
] as const;

export const getRandomCelebrationMessage = () =>
  CELEBRATION_MESSAGES[
    Math.floor(Math.random() * CELEBRATION_MESSAGES.length)
  ];


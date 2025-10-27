// src/styles/theme.ts
// Weekly Eats design tokens (light + dark)
// Use with styled-components or your own ThemeContext.

export type Mode = "light" | "dark";

const colors = {
  // shared brand accents
  accent: "#FF4B91", // primary pink (CTA, active track)
  link: "#3ABEF0", // "Add Ingredient" / link text
  success: "#00FF9C", // cost "$", "$$", "$$$"
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

const darkPalette = {
  bg: "#1A1A1D",
  surface: "#2A2A2E",
  surfaceAlt: "#242428",
  ink: "#FFFFFF",
  subtleInk: "#A0A0A0",
  border: "rgba(255, 255, 255, 0.06)",
  focus: "rgba(255, 75, 145, 0.35)", // pink glow
  // decorative
  cardOutline: "rgba(255, 75, 145, 0.20)", // matches meal card borders
} as const;

const lightPalette = {
  bg: "#FFFFFF",
  surface: "#F6F7F9",
  surfaceAlt: "#EEEEF2",
  ink: "#0A0A0A",
  subtleInk: "#6B7280",
  border: "rgba(10, 10, 10, 0.08)",
  focus: "rgba(79, 70, 229, 0.35)",
  cardOutline: "rgba(79, 70, 229, 0.15)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16, // cards in screenshots
  xl: 24, // CTA button
  full: 999,
} as const;

export const typography = {
  family: {
    default: undefined, // use system fonts
    mono: undefined,
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    title: 20, // field titles (e.g., “Difficulty”)
    h2: 22,
    h1: 28, // “Weekly Eats” header
  },
  weight: {
    regular: "400" as const,
    medium: "600" as const,
    bold: "700" as const,
  },
} as const;

export const motion = {
  duration: {
    fast: 80, // press feedback
    normal: 180, // modal exit
    slow: 240, // modal enter
  },
  easing: {
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;

export const elevation = {
  card: 2,
  modal: 8,
} as const;

// Component-level tokens that match designs
const components = {
  button: {
    height: 52,
    radius: radius.xl,
    paddingH: space.lg,
  },
  input: {
    height: 48,
    radius: radius.md,
    paddingH: space.md,
  },
  chip: {
    radius: radius.md,
    paddingH: space.md,
    paddingV: 6,
  },
  slider: {
    trackHeight: 4,
    thumbSize: 16,
  },
  tabs: {
    underlineHeight: 5,
  },
} as const;

export type WeeklyTheme = {
  mode: Mode;
  color: typeof colors & (typeof darkPalette | typeof lightPalette); // palette merged below
  space: typeof space;
  radius: typeof radius;
  type: typeof typography;
  motion: typeof motion;
  elevation: typeof elevation;
  component: typeof components;
};

// small util
export const alpha = (hex: string, a: number) =>
  hex.startsWith("#")
    ? `${hex}${Math.round(a * 255)
        .toString(16)
        .padStart(2, "0")}`
    : hex;

// Factory (choose palette by mode)
export const makeTheme = (mode: Mode = "dark"): WeeklyTheme => {
  const palette = mode === "dark" ? darkPalette : lightPalette;
  return {
    mode,
    color: { ...colors, ...palette },
    space,
    radius,
    type: typography,
    motion,
    elevation,
    component: components,
  };
};

// Ready-to-use themes
export const darkTheme = makeTheme("dark");
export const lightTheme = makeTheme("light");

// Example semantic aliases (optional)
export const tokens = {
  cardBg: (t: WeeklyTheme) => t.color.surface,
  cardBorder: (t: WeeklyTheme) => t.color.cardOutline,
  ctaBg: (t: WeeklyTheme) => t.color.accent,
  link: (t: WeeklyTheme) => t.color.link,
  cost: (t: WeeklyTheme) => t.color.success,
};
export default darkTheme;

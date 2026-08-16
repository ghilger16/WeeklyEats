export const CUISINE_OPTIONS = [
  { value: "american", label: "American" },
  { value: "bbq", label: "BBQ" },
  { value: "cajunCreole", label: "Cajun / Creole" },
  { value: "caribbean", label: "Caribbean" },
  { value: "chinese", label: "Chinese" },
  { value: "french", label: "French" },
  { value: "greek", label: "Greek" },
  { value: "indian", label: "Indian" },
  { value: "italian", label: "Italian" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "mexican", label: "Mexican" },
  { value: "middleEastern", label: "Middle Eastern" },
  { value: "southern", label: "Southern" },
  { value: "spanish", label: "Spanish" },
  { value: "texMex", label: "Tex-Mex" },
  { value: "thai", label: "Thai" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "other", label: "Other" },
] as const;

export type CuisineType = (typeof CUISINE_OPTIONS)[number]["value"];

export const isCuisineType = (value: unknown): value is CuisineType =>
  CUISINE_OPTIONS.some((option) => option.value === value);

export const getCuisineLabel = (cuisine?: CuisineType | null) =>
  CUISINE_OPTIONS.find((option) => option.value === cuisine)?.label;

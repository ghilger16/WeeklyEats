import { createContext } from "react";
import type { GridContextValue } from "./types";

export const defaultGridContext: GridContextValue = {
  gutterHorizontal: 0,
  gutterVertical: 0,
  hasGutterWidthAtBorders: false,
  hasGutterHeightAtBorders: false,
  columns: 12,
};

export const FlexGridContext = createContext<GridContextValue>(defaultGridContext);

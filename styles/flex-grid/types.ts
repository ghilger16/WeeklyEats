import type { PropsWithChildren } from "react";
import type { FlexAlignType, ViewProps, ViewStyle } from "react-native";

export type GridJustifyContent = ViewStyle["justifyContent"];
export type GridAlignItems = FlexAlignType;

export type GridPadding =
  | number
  | {
      horizontal?: number;
      vertical?: number;
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };

export type GridContextValue = {
  gutterHorizontal: number;
  gutterVertical: number;
  hasGutterWidthAtBorders: boolean;
  hasGutterHeightAtBorders: boolean;
  columns: number;
};

export type FlexGridProps = PropsWithChildren<
  ViewProps & {
    gutterWidth?: number;
    gutterHeight?: number;
    hasGutterWidthAtBorders?: boolean;
    hasGutterHeightAtBorders?: boolean;
    columns?: number;
    padding?: GridPadding;
  }
>;

export type FlexRowProps = ViewProps & {
  alignItems?: GridAlignItems;
  justifyContent?: GridJustifyContent;
  wrap?: boolean;
  reverse?: boolean;
};

export type FlexColProps = ViewProps & {
  span?: number;
  offset?: number;
  grow?: number;
  shrink?: number;
  alignSelf?: ViewStyle["alignSelf"];
};

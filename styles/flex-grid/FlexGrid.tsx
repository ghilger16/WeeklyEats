import { forwardRef, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { View as RNView } from "react-native";
import { FlexGridContext, defaultGridContext } from "./FlexGridContext";
import type { FlexGridProps, GridPadding } from "./types";
import { FlexRow } from "./FlexRow";
import { FlexCol } from "./FlexCol";

const createPaddingStyle = (padding?: GridPadding) => {
  if (typeof padding === "number") {
    return { padding };
  }
  if (!padding) {
    return null;
  }
  return {
    paddingHorizontal: padding.horizontal,
    paddingVertical: padding.vertical,
    paddingTop: padding.top,
    paddingBottom: padding.bottom,
    paddingLeft: padding.left,
    paddingRight: padding.right,
  };
};

const FlexGridBase = forwardRef<RNView, FlexGridProps>(function FlexGridBase(
  {
    gutterWidth = defaultGridContext.gutterHorizontal,
    gutterHeight = defaultGridContext.gutterVertical,
    hasGutterWidthAtBorders = defaultGridContext.hasGutterWidthAtBorders,
    hasGutterHeightAtBorders = defaultGridContext.hasGutterHeightAtBorders,
    columns = defaultGridContext.columns,
    padding,
    style,
    children,
    ...rest
  },
  ref
) {
  const contextValue = useMemo(
    () => ({
      gutterHorizontal: gutterWidth,
      gutterVertical: gutterHeight,
      hasGutterWidthAtBorders,
      hasGutterHeightAtBorders,
      columns,
    }),
    [
      columns,
      gutterHeight,
      gutterWidth,
      hasGutterHeightAtBorders,
      hasGutterWidthAtBorders,
    ]
  );

  const paddingStyle = useMemo(() => createPaddingStyle(padding), [padding]);

  const combinedStyle = useMemo(
    () => StyleSheet.compose(paddingStyle, style),
    [paddingStyle, style]
  );

  return (
    <FlexGridContext.Provider value={contextValue}>
      <View ref={ref} style={combinedStyle} {...rest}>
        {children}
      </View>
    </FlexGridContext.Provider>
  );
});

export const FlexGrid = Object.assign(FlexGridBase, {
  Row: FlexRow,
  Col: FlexCol,
});

export default FlexGrid;

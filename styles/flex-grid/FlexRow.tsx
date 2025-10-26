import { forwardRef, useContext, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { View as RNView } from "react-native";
import { FlexGridContext } from "./FlexGridContext";
import type { FlexRowProps } from "./types";

const FlexRowBase = forwardRef<RNView, FlexRowProps>(function FlexRowBase(
  { wrap = false, reverse = false, alignItems, justifyContent, style, children, ...rest },
  ref
) {
  const context = useContext(FlexGridContext);
  const halfGutterX = context.gutterHorizontal / 2;
  const halfGutterY = context.gutterVertical / 2;

  const rowStyle = useMemo(
    () => [
      styles.row,
      wrap && styles.wrap,
      reverse && styles.reverse,
      alignItems ? { alignItems } : null,
      justifyContent ? { justifyContent } : null,
      !context.hasGutterWidthAtBorders && context.gutterHorizontal
        ? {
            marginLeft: -halfGutterX,
            marginRight: -halfGutterX,
          }
        : null,
      !context.hasGutterHeightAtBorders && context.gutterVertical
        ? {
            marginTop: -halfGutterY,
            marginBottom: -halfGutterY,
          }
        : null,
      style,
    ],
    [
      alignItems,
      context.gutterHorizontal,
      context.gutterVertical,
      context.hasGutterHeightAtBorders,
      context.hasGutterWidthAtBorders,
      halfGutterX,
      halfGutterY,
      justifyContent,
      reverse,
      style,
      wrap,
    ]
  );

  return (
    <View ref={ref} style={rowStyle} {...rest}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  wrap: {
    flexWrap: "wrap",
  },
  reverse: {
    flexDirection: "row-reverse",
  },
});

export const FlexRow = Object.assign(FlexRowBase, { displayName: "FlexRow" });

export default FlexRow;

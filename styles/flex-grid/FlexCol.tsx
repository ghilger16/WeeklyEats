import { forwardRef, useContext, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { View as RNView } from "react-native";
import { FlexGridContext } from "./FlexGridContext";
import type { FlexColProps } from "./types";

const toPercent = (value: number) => `${value * 100}%`;

const FlexColBase = forwardRef<RNView, FlexColProps>(function FlexColBase(
  { span, offset, grow, shrink, alignSelf, style, children, ...rest },
  ref
) {
  const context = useContext(FlexGridContext);
  const halfGutterX = context.gutterHorizontal / 2;
  const halfGutterY = context.gutterVertical / 2;

  const columnStyle = useMemo(() => {
    const stylesArray = [
      baseStyles.column,
      halfGutterX
        ? {
            paddingLeft: halfGutterX,
            paddingRight: halfGutterX,
          }
        : null,
      halfGutterY
        ? {
            paddingTop: halfGutterY,
            paddingBottom: halfGutterY,
          }
        : null,
    ];

    if (typeof span === "number") {
      const clampSpan = Math.max(0, Math.min(span, context.columns));
      const percent =
        clampSpan === 0 ? undefined : toPercent(clampSpan / context.columns);
      stylesArray.push({
        flexBasis: percent ?? "auto",
        maxWidth: percent ?? "100%",
        flexGrow: percent ? 0 : 0,
      });
    }

    if (typeof offset === "number" && offset > 0) {
      const clampedOffset = Math.min(offset, context.columns);
      stylesArray.push({
        marginLeft: toPercent(clampedOffset / context.columns),
      });
    }

    if (typeof grow === "number") {
      stylesArray.push({ flexGrow: grow });
    }

    if (typeof shrink === "number") {
      stylesArray.push({ flexShrink: shrink });
    }

    if (alignSelf) {
      stylesArray.push({ alignSelf });
    }

    if (style) {
      stylesArray.push(style);
    }

    return stylesArray;
  }, [
    alignSelf,
    context.columns,
    halfGutterX,
    halfGutterY,
    grow,
    offset,
    shrink,
    span,
    style,
  ]);

  return (
    <View ref={ref} style={columnStyle} {...rest}>
      {children}
    </View>
  );
});

const baseStyles = StyleSheet.create({
  column: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
  },
});

export const FlexCol = Object.assign(FlexColBase, { displayName: "FlexCol" });

export default FlexCol;

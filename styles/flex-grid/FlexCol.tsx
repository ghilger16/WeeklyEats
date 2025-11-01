import { forwardRef, useContext, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, View as RNView, ViewStyle } from "react-native";
import { FlexGridContext } from "./FlexGridContext";
import type { FlexColProps } from "./types";

const toPercent = (value: number): `${number}%` => `${value * 100}%` as `${number}%`;

const FlexColBase = forwardRef<RNView, FlexColProps>(function FlexColBase(
  { span, offset, grow, shrink, alignSelf, style, children, ...rest },
  ref
) {
  const context = useContext(FlexGridContext);
  const halfGutterX = context.gutterHorizontal / 2;
  const halfGutterY = context.gutterVertical / 2;

  const columnStyle = useMemo<StyleProp<ViewStyle>>(() => {
    const dynamicStyles: ViewStyle[] = [];

    if (halfGutterX) {
      dynamicStyles.push({
        paddingLeft: halfGutterX,
        paddingRight: halfGutterX,
      });
    }

    if (halfGutterY) {
      dynamicStyles.push({
        paddingTop: halfGutterY,
        paddingBottom: halfGutterY,
      });
    }

    if (typeof span === "number") {
      const clampSpan = Math.max(0, Math.min(span, context.columns));
      const percent =
        clampSpan === 0 ? undefined : toPercent(clampSpan / context.columns);
      if (percent) {
        dynamicStyles.push({
          flexBasis: percent,
          maxWidth: percent,
          flexGrow: 0,
        });
      } else {
        dynamicStyles.push({
          flexGrow: 0,
        });
      }
    }

    if (typeof offset === "number" && offset > 0) {
      const clampedOffset = Math.min(offset, context.columns);
      dynamicStyles.push({
        marginLeft: toPercent(clampedOffset / context.columns),
      });
    }

    if (typeof grow === "number") {
      dynamicStyles.push({ flexGrow: grow });
    }

    if (typeof shrink === "number") {
      dynamicStyles.push({ flexShrink: shrink });
    }

    if (alignSelf) {
      dynamicStyles.push({ alignSelf });
    }

    let composed: StyleProp<ViewStyle> = baseStyles.column;

    if (dynamicStyles.length) {
      composed = StyleSheet.compose(composed, dynamicStyles);
    }

    if (style) {
      composed = StyleSheet.compose(composed, style);
    }

    return composed;
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

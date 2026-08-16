import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";

type Props = {
  sides: string[];
};

export default function CompactSidesSummary({ sides }: Props) {
  const { theme } = useThemeController();
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(0);
  const [measuredWidths, setMeasuredWidths] = useState<Record<string, number>>({});

  const candidates = useMemo(() => {
    const values: string[] = [];
    for (let visibleCount = sides.length; visibleCount >= 1; visibleCount -= 1) {
      const hiddenCount = sides.length - visibleCount;
      values.push(
        hiddenCount
          ? `${sides.slice(0, visibleCount).join(" • ")} • +${hiddenCount} more`
          : sides.join(" • "),
      );
    }
    values.push(`${sides.length} ${sides.length === 1 ? "side" : "sides"}`);
    return [...new Set(values)];
  }, [sides]);

  useEffect(() => {
    setMeasuredWidths({});
  }, [fontScale]);

  const namedCandidates = candidates.slice(0, -1);
  const fittingCandidate = namedCandidates.find(
    (candidate) =>
      measuredWidths[candidate] !== undefined &&
      measuredWidths[candidate] <= availableWidth,
  );
  const hasMeasuredEveryCandidate = namedCandidates.every(
    (candidate) => measuredWidths[candidate] !== undefined,
  );
  const summary =
    fittingCandidate ??
    (hasMeasuredEveryCandidate
      ? candidates[candidates.length - 1] ?? ""
      : candidates[0] ?? "");

  if (!sides.length) return null;

  const handleLayout = (event: LayoutChangeEvent) => {
    setAvailableWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Text style={[styles.summary, { color: theme.color.subtleInk }]} numberOfLines={1}>
        {summary}
      </Text>
      <View
        style={styles.measurementArea}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {candidates.map((candidate) => (
          <Text
            key={`${fontScale}-${candidate}`}
            style={styles.measurementText}
            numberOfLines={1}
            onTextLayout={(event) => {
              const width = event.nativeEvent.lines[0]?.width;
              if (width === undefined) return;
              setMeasuredWidths((current) =>
                current[candidate] === width
                  ? current
                  : { ...current, [candidate]: width },
              );
            }}
          >
            {candidate}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  summary: {
    fontSize: 14,
    fontWeight: "400",
  },
  measurementArea: {
    position: "absolute",
    left: -10000,
    width: 10000,
  },
  measurementText: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "400",
  },
});

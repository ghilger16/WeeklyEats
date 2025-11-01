import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type DateControlsProps = {
  formattedDate: string;
  isSimulatedDate: boolean;
  showControls: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onClearWeekPlan: () => Promise<void> | void;
  onClearServedMeals: () => Promise<void> | void;
  onTogglePreview: () => void;
  isPreviewVisible: boolean;
  previewContent: string;
};

export default function DateControls({
  formattedDate,
  isSimulatedDate,
  showControls,
  onPrevDay,
  onNextDay,
  onClearWeekPlan,
  onClearServedMeals,
  onTogglePreview,
  isPreviewVisible,
  previewContent,
}: DateControlsProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.dateLabel}>
        {isSimulatedDate ? "Simulated Date" : "Today"}
      </Text>
      <Text style={styles.dateValue}>{formattedDate}</Text>

      {showControls ? (
        <>
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View previous day"
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.controlButtonPressed,
              ]}
              onPress={onPrevDay}
            >
              <Text style={styles.controlButtonText}>Prev Day</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View next day"
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.controlButtonPressed,
              ]}
              onPress={onNextDay}
            >
              <Text style={styles.controlButtonText}>Next Day</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear planned week data"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={onClearWeekPlan}
            >
              <Text style={styles.secondaryButtonText}>Clear Week Plan</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear served meals data"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={onClearServedMeals}
            >
              <Text style={styles.secondaryButtonText}>Clear Served Meals</Text>
            </Pressable>
          </View>

          <View style={styles.previewButtonWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview stored data"
              style={({ pressed }) => [
                styles.previewButton,
                pressed && styles.previewButtonPressed,
              ]}
              onPress={onTogglePreview}
            >
              <Text style={styles.previewButtonText}>
                {isPreviewVisible ? "Hide Preview" : "Preview Data"}
              </Text>
            </Pressable>
          </View>

          {isPreviewVisible ? (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Stored Data</Text>
              <Text selectable style={styles.previewText}>
                {previewContent}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      gap: theme.space.xs,
    },
    dateLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    dateValue: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    buttonRow: {
      flexDirection: "row",
      gap: theme.space.sm,
      marginTop: theme.space.sm,
    },
    controlButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    controlButtonPressed: {
      opacity: 0.85,
    },
    controlButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    secondaryButton: {
      flex: 1,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    secondaryButtonPressed: {
      opacity: 0.85,
    },
    secondaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textAlign: "center",
    },
    previewButtonWrapper: {
      marginTop: theme.space.sm,
    },
    previewButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignItems: "center",
    },
    previewButtonPressed: {
      opacity: 0.85,
    },
    previewButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    previewContainer: {
      marginTop: theme.space.sm,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      gap: theme.space.xs,
    },
    previewLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    previewText: {
      color: theme.color.ink,
      fontSize: theme.type.size.xs,
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "monospace",
      }),
    },
  });

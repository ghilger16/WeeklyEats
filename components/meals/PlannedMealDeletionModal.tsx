import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import { PlannedMealOccurrence } from "../../utils/plannedMealDeletion";

type Props = {
  meal: Meal | null;
  occurrences: PlannedMealOccurrence[];
  onClose: () => void;
};

export default function PlannedMealDeletionModal({ meal, occurrences, onClose }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!meal) return null;

  const contextualMessage = occurrences.length === 1
    ? `${meal.title} is planned for ${occurrences[0].dayLabel} ${occurrences[0].scope === "current" ? "this week" : "next week"}.`
    : `${meal.title} is currently scheduled ${occurrences.length} times.`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close planned meal notice"
        />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.eyebrow}>This meal is planned</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="close" size={23} color={theme.color.ink} />
            </Pressable>
          </View>
          <Text style={styles.title}>{contextualMessage}</Text>
          <Text style={styles.message}>
            {occurrences.length === 1
              ? "Replace or remove it from your plan before deleting this meal."
              : "Replace or remove these planned meals before deleting it."}
          </Text>
          <OccurrenceSummary occurrences={occurrences} mealTitle={meal.title} styles={styles} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function OccurrenceSummary({ occurrences, mealTitle, styles }: {
  occurrences: PlannedMealOccurrence[];
  mealTitle: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summaryGroups}>
      {(["current", "next"] as const).map((scope) => {
        const items = occurrences.filter((item) => item.scope === scope);
        if (!items.length) return null;
        return (
          <View key={scope} style={styles.summaryGroup}>
            <Text style={styles.groupLabel}>{scope === "current" ? "This Week" : "Next Week"}</Text>
            {items.map((item) => (
              <Text key={`${item.weekStartISO}:${item.dayKey}`} style={styles.summaryOccurrence}>
                {item.dayLabel} · {mealTitle}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: { gap: theme.space.lg, paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm, paddingBottom: theme.space.xl, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, backgroundColor: theme.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  handle: { width: 40, height: 4, alignSelf: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.subtleInk, opacity: 0.45 },
  header: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space.md },
  eyebrow: { flex: 1, color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textTransform: "uppercase", letterSpacing: 0.9 },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
  title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold, lineHeight: theme.type.size.h2 * 1.2 },
  message: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: theme.type.size.sm * 1.4 },
  summaryGroups: { gap: theme.space.md },
  summaryGroup: { gap: theme.space.xs },
  groupLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  summaryOccurrence: { minHeight: 42, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm, borderRadius: theme.radius.md, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium, backgroundColor: theme.color.surfaceAlt },
  pressed: { opacity: 0.75 },
});

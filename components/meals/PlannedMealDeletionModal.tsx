import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import {
  PlannedMealOccurrence,
  resolvePlannedMealOccurrence,
} from "../../utils/plannedMealDeletion";
import MealSearchModal from "./MealSearchModal";

type Props = {
  meal: Meal | null;
  occurrences: PlannedMealOccurrence[];
  replacementMeals: Meal[];
  onCancel: () => void;
  onDelete: () => Promise<void> | void;
};

export default function PlannedMealDeletionModal({
  meal,
  occurrences: initialOccurrences,
  replacementMeals,
  onCancel,
  onDelete,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [phase, setPhase] = useState<"warning" | "resolve">("warning");
  const [occurrences, setOccurrences] = useState(initialOccurrences);
  const [replacementTarget, setReplacementTarget] =
    useState<PlannedMealOccurrence | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (meal) {
      setPhase("warning");
      setOccurrences(initialOccurrences);
      setReplacementTarget(null);
      setSavingKey(null);
    }
  }, [initialOccurrences, meal]);

  if (!meal) return null;

  const occurrenceKey = (occurrence: PlannedMealOccurrence) =>
    `${occurrence.weekStartISO}:${occurrence.dayKey}`;
  const removeResolvedOccurrence = (occurrence: PlannedMealOccurrence) => {
    const key = occurrenceKey(occurrence);
    setOccurrences((current) =>
      current.filter((item) => occurrenceKey(item) !== key),
    );
  };
  const resolveOccurrence = async (
    occurrence: PlannedMealOccurrence,
    replacementMealId: string | null,
  ) => {
    const key = occurrenceKey(occurrence);
    setSavingKey(key);
    await resolvePlannedMealOccurrence({ occurrence, replacementMealId });
    removeResolvedOccurrence(occurrence);
    setSavingKey(null);
  };

  const groupedOccurrences = (["current", "next"] as const)
    .map((scope) => ({
      scope,
      items: occurrences.filter((occurrence) => occurrence.scope === scope),
    }))
    .filter((group) => group.items.length > 0);
  const originalCount = initialOccurrences.length;
  const contextualMessage =
    originalCount === 1
      ? `${meal.title} is planned for ${initialOccurrences[0].dayLabel} ${
          initialOccurrences[0].scope === "current" ? "this week" : "next week"
        }.`
      : `${meal.title} is currently scheduled ${originalCount} times.`;
  const allResolved = occurrences.length === 0;

  return (
    <>
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={onCancel}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel meal deletion"
          />
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.handle} />
            {phase === "warning" ? (
              <View style={styles.content}>
                <Text style={styles.eyebrow}>This meal is planned</Text>
                <Text style={styles.title}>{contextualMessage}</Text>
                <Text style={styles.message}>
                  {originalCount === 1
                    ? "Replace or remove it from your plan before deleting this meal."
                    : "Replace or remove these planned meals before deleting it."}
                </Text>
                <OccurrenceSummary
                  occurrences={initialOccurrences}
                  mealTitle={meal.title}
                  styles={styles}
                />
                <Pressable
                  onPress={() => setPhase("resolve")}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>
                    Resolve Planned Meals
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.content}>
                <View style={styles.resolveHeader}>
                  <View style={styles.resolveHeaderCopy}>
                    <Text style={styles.eyebrow}>Resolve planned meals</Text>
                    <Text style={styles.title}>Replace {meal.title}</Text>
                  </View>
                  <Pressable
                    onPress={onCancel}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={23}
                      color={theme.color.ink}
                    />
                  </Pressable>
                </View>
                {allResolved ? (
                  <View style={styles.resolvedState}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={38}
                      color={theme.color.success}
                    />
                    <Text style={styles.resolvedTitle}>
                      Planned meals resolved
                    </Text>
                    <Text style={styles.message}>
                      {meal.title} can now be deleted from your meals.
                    </Text>
                    <Pressable
                      onPress={() => void onDelete()}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.deleteButtonText}>Delete Meal</Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.resolutionList}
                  >
                    {groupedOccurrences.map((group) => (
                      <View key={group.scope} style={styles.group}>
                        <Text style={styles.groupLabel}>
                          {group.scope === "current" ? "This Week" : "Next Week"}
                        </Text>
                        {group.items.map((occurrence) => {
                          const key = occurrenceKey(occurrence);
                          const isSaving = savingKey === key;
                          return (
                            <View key={key} style={styles.occurrenceCard}>
                              <View style={styles.occurrenceCopy}>
                                <Text style={styles.dayLabel}>
                                  {occurrence.dayKey.toUpperCase()}
                                </Text>
                                <Text style={styles.mealTitle}>{meal.title}</Text>
                              </View>
                              {isSaving ? (
                                <ActivityIndicator color={theme.color.accent} />
                              ) : (
                                <View style={styles.occurrenceActions}>
                                  <Pressable
                                    disabled={savingKey !== null}
                                    onPress={() => setReplacementTarget(occurrence)}
                                    style={({ pressed }) => [
                                      styles.chooseButton,
                                      pressed && styles.pressed,
                                    ]}
                                  >
                                    <Text style={styles.chooseButtonText}>
                                      Choose Replacement
                                    </Text>
                                  </Pressable>
                                  <Pressable
                                    disabled={savingKey !== null}
                                    onPress={() =>
                                      void resolveOccurrence(occurrence, null)
                                    }
                                    style={({ pressed }) => [
                                      styles.removeButton,
                                      pressed && styles.pressed,
                                    ]}
                                  >
                                    <Text style={styles.removeButtonText}>
                                      Remove from Plan
                                    </Text>
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
      <MealSearchModal
        visible={Boolean(replacementTarget)}
        meals={replacementMeals}
        title={`Replace ${meal.title}`}
        subtitle="Choose a meal for this planned day."
        onDismiss={() => setReplacementTarget(null)}
        onSelectMeal={(replacement) => {
          if (!replacementTarget) return;
          const target = replacementTarget;
          setReplacementTarget(null);
          void resolveOccurrence(target, replacement.id);
        }}
      />
    </>
  );
}

function OccurrenceSummary({
  occurrences,
  mealTitle,
  styles,
}: {
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
            <Text style={styles.groupLabel}>
              {scope === "current" ? "This Week" : "Next Week"}
            </Text>
            {items.map((item) => (
              <Text
                key={`${item.weekStartISO}:${item.dayKey}`}
                style={styles.summaryOccurrence}
              >
                {item.dayLabel} · {mealTitle}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.58)",
    },
    sheet: {
      maxHeight: "88%",
      gap: theme.space.md,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.sm,
      paddingBottom: theme.space.xl,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    handle: {
      width: 40,
      height: 4,
      alignSelf: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.subtleInk,
      opacity: 0.45,
    },
    content: { gap: theme.space.lg },
    eyebrow: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.9,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      lineHeight: theme.type.size.h2 * 1.2,
    },
    message: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.4,
      textAlign: "center",
    },
    summaryGroups: { gap: theme.space.md },
    summaryGroup: { gap: theme.space.xs },
    groupLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    summaryOccurrence: {
      minHeight: 42,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      backgroundColor: theme.color.surfaceAlt,
    },
    primaryButton: {
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.accent,
      paddingHorizontal: theme.space.lg,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    cancelButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    resolveHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.space.md,
    },
    resolveHeaderCopy: { flex: 1, gap: theme.space.xs },
    closeButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    resolutionList: { gap: theme.space.lg, paddingBottom: theme.space.sm },
    group: { gap: theme.space.sm },
    occurrenceCard: {
      gap: theme.space.md,
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
    },
    occurrenceCopy: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    dayLabel: {
      width: 38,
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.7,
    },
    mealTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    occurrenceActions: { gap: theme.space.sm },
    chooseButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.accent,
    },
    chooseButtonText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    removeButton: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    removeButtonText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    resolvedState: {
      alignItems: "center",
      gap: theme.space.md,
      paddingVertical: theme.space.lg,
    },
    resolvedTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    deleteButton: {
      width: "100%",
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.danger,
    },
    deleteButtonText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    pressed: { opacity: 0.75 },
  });

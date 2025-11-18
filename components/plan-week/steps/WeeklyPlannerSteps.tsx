import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { WeeklyWeekSettings } from "../weekPlanner";

type Props = {
  initialSettings?: Partial<WeeklyWeekSettings>;
  onComplete: (settings: WeeklyWeekSettings) => void;
  onCancel?: () => void;
};

const STEPS = 2;

const weeklyMoodOptions: Array<{
  id: WeeklyWeekSettings["mood"];
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    id: "low_effort",
    emoji: "😴",
    label: "Low Effort Week",
    description: "Quick, simple dinners. Extra busy this week.",
  },
  {
    id: "balanced",
    emoji: "🙂",
    label: "Balanced Week",
    description: "A mix of easy and medium meals.",
  },
  {
    id: "motivated",
    emoji: "💪✨",
    label: "Motivated Week",
    description: "You’re up for more cooking and new recipes.",
  },
];

const reuseOptions: Array<{
  id: WeeklyWeekSettings["reuseWindowWeeks"];
  label: string;
  description: string;
}> = [
  { id: null, label: "I don’t mind repeats", description: "Suggest anything." },
  { id: 1, label: "Avoid meals from last week", description: "1 week gap." },
  { id: 2, label: "Avoid meals from last 2 weeks", description: "2 week gap." },
  { id: 3, label: "Avoid meals from last 3 weeks", description: "3 week gap." },
];

export const WeeklyPlannerSteps = ({
  initialSettings,
  onComplete,
  onCancel,
}: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [stepIndex, setStepIndex] = useState(0);
  const [settings, setSettings] = useState<WeeklyWeekSettings>({
    mood: initialSettings?.mood ?? "balanced",
    reuseWindowWeeks:
      initialSettings?.reuseWindowWeeks === undefined
        ? 2
        : initialSettings.reuseWindowWeeks,
  });

  const handleSelectMood = useCallback((mood: WeeklyWeekSettings["mood"]) => {
    setSettings((prev) => ({ ...prev, mood }));
  }, []);

  const handleSelectReuse = useCallback(
    (reuseWindowWeeks: WeeklyWeekSettings["reuseWindowWeeks"]) => {
      setSettings((prev) => ({ ...prev, reuseWindowWeeks }));
    },
    []
  );

  const handleNext = useCallback(() => {
    if (stepIndex === 0) {
      setStepIndex(1);
    } else {
      onComplete(settings);
    }
  }, [onComplete, settings, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      onCancel?.();
      return;
    }
    setStepIndex(0);
  }, [onCancel, stepIndex]);

  const canContinue =
    stepIndex === 0 ? Boolean(settings.mood) : settings.reuseWindowWeeks !== undefined;
  const primaryLabel = stepIndex === 0 ? "Next" : "Finish Setup";

  const renderMoodStep = () => (
    <View style={styles.optionGrid}>
      {weeklyMoodOptions.map((option) => {
        const isSelected = settings.mood === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => handleSelectMood(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label}${
              isSelected ? ", selected" : ""
            }`}
            style={({ pressed }) => [
              styles.moodTile,
              isSelected && styles.moodTileSelected,
              pressed && styles.moodTilePressed,
            ]}
          >
            <Text style={styles.moodEmoji}>{option.emoji}</Text>
            <Text style={styles.moodLabel}>{option.label}</Text>
            <Text style={styles.moodDescription}>{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderReuseStep = () => (
    <View style={styles.optionGrid}>
      {reuseOptions.map((option) => {
        const isSelected = settings.reuseWindowWeeks === option.id;
        return (
          <Pressable
            key={option.label}
            onPress={() => handleSelectReuse(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label}${
              isSelected ? ", selected" : ""
            }`}
            style={({ pressed }) => [
              styles.reusePill,
              isSelected && styles.reusePillSelected,
              pressed && styles.reusePillPressed,
            ]}
          >
            <Text
              style={[
                styles.reusePillLabel,
                isSelected && styles.reusePillLabelSelected,
              ]}
            >
              {option.label}
            </Text>
            <Text style={styles.reusePillDescription}>{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss setup"
            style={styles.closeButton}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.color.ink}
            />
          </Pressable>
        ) : (
          <View style={styles.closeButtonPlaceholder} />
        )}
        <Text style={styles.stepLabel}>Step {stepIndex + 1} of {STEPS}</Text>
      </View>
      <View style={styles.heroText}>
        <Text style={styles.title}>
          {stepIndex === 0
            ? "What’s your cooking vibe this week?"
            : "How much variety do you want this week?"}
        </Text>
        <Text style={styles.subtitle}>
          {stepIndex === 0
            ? "We’ll use this to start each day with the right difficulty."
            : "We’ll avoid suggesting meals you had too recently."}
        </Text>
      </View>
      <View style={styles.stepContent}>
        {stepIndex === 0 ? renderMoodStep() : renderReuseStep()}
      </View>
      <View style={styles.footer}>
        {stepIndex === 1 ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleNext}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          style={({ pressed }) => [
            styles.primaryButton,
            !canContinue && styles.primaryButtonDisabled,
            pressed && canContinue && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: theme.color.bg,
      padding: theme.space.xl,
      gap: theme.space.lg,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    closeButtonPlaceholder: {
      width: 44,
      height: 44,
    },
    stepLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    heroText: {
      gap: theme.space.sm,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    stepContent: {
      flex: 1,
      justifyContent: "center",
    },
    optionGrid: {
      gap: theme.space.md,
    },
    moodTile: {
      borderRadius: theme.radius.xl,
      padding: theme.space.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      gap: theme.space.sm,
    },
    moodTileSelected: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    moodTilePressed: {
      opacity: 0.9,
    },
    moodEmoji: {
      fontSize: 40,
    },
    moodLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    moodDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    reusePill: {
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.lg,
      backgroundColor: theme.color.surfaceAlt,
      gap: 4,
    },
    reusePillSelected: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    reusePillPressed: {
      opacity: 0.9,
    },
    reusePillLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    reusePillLabelSelected: {
      color: theme.color.accent,
    },
    reusePillDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    footer: {
      gap: theme.space.sm,
    },
    primaryButton: {
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.4,
    },
    primaryButtonPressed: {
      opacity: 0.85,
    },
    primaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    secondaryButton: {
      alignItems: "center",
      justifyContent: "center",
      height: 44,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    secondaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
  });

export default WeeklyPlannerSteps;

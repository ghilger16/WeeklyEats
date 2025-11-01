import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  SERVED_ACTIONS,
  type ServedAction,
} from "./servedActions";

type UnmarkedCardProps = {
  meal: Meal;
  dateLabel: string;
  onSelectOutcome?: (outcome: ServedAction["value"]) => Promise<void> | void;
};

export default function UnmarkedCard({
  meal,
  dateLabel,
  onSelectOutcome,
}: UnmarkedCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mealEmoji = meal.emoji ?? "🍽️";
  const notes = meal.prepNotes ?? "";

  const handleOpenRecipe = () => {
    if (!meal.recipeUrl) {
      return;
    }
    Linking.openURL(meal.recipeUrl).catch(() => {
      // Intentionally ignore open failure; could surface toast later.
    });
  };

  const handleSelectOutcome = async (value: ServedAction["value"]) => {
    try {
      await onSelectOutcome?.(value);
    } catch (error) {
      console.warn("[UnmarkedCard] Failed to record outcome", error);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.touchArea}
        accessibilityRole={meal.recipeUrl ? "button" : undefined}
        accessibilityLabel={
          meal.recipeUrl ? `Open recipe for ${meal.title}` : undefined
        }
        onPress={meal.recipeUrl ? handleOpenRecipe : undefined}
      >
        <View style={styles.topRow}>
          <Text style={styles.date}>{dateLabel}</Text>
          <View style={styles.statusTag}>
            <Text style={styles.statusTagText}>Not served</Text>
          </View>
        </View>

        <Text style={styles.emoji} accessibilityLabel={`${meal.title} meal`}>
          {mealEmoji}
        </Text>

        <Text style={styles.title}>{meal.title}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </Pressable>

      <View style={styles.actionList}>
        {SERVED_ACTIONS.map((action) => (
          <Pressable
            key={action.value}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => handleSelectOutcome(action.value)}
          >
            <MaterialCommunityIcons
              name={action.icon}
              size={18}
              color={theme.color.ink}
            />
            <Text style={styles.actionButtonText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.lg,
      paddingBottom: theme.space.lg,
      gap: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    touchArea: {
      alignItems: "center",
      gap: theme.space.md,
    },
    topRow: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    date: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    statusTag: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    statusTagText: {
      color: theme.color.warning,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    emoji: {
      fontSize: 48,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    notes: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    actionList: {
      gap: theme.space.sm,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
  });


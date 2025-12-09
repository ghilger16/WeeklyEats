import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import {
  SERVED_ACTIONS,
  type ServedAction,
} from "./servedActions";
import { getRandomCelebrationMessage } from "./celebrations";

type TodayCardProps = {
  meal: Meal;
  dateLabel: string;
  notes?: string;
  servedEntry?: ServedMealEntry;
  onMarkServed?: (message: string) => Promise<void> | void;
  onSelectOutcome?: (outcome: ServedAction["value"]) => Promise<void> | void;
};

export default function TodayCard({
  meal,
  dateLabel,
  notes,
  servedEntry,
  onMarkServed,
  onSelectOutcome,
}: TodayCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isExpanded, setExpanded] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(
    servedEntry?.celebrationMessage ?? null
  );

  const isServed = servedEntry?.outcome === "served";
  const prepNotesToShow = notes ?? meal.prepNotes ?? "";

  useEffect(() => {
    setCelebrationMessage(servedEntry?.celebrationMessage ?? null);
  }, [servedEntry?.celebrationMessage]);

  const handleCardPress = () => {
    if (isExpanded) {
      return;
    }

    if (meal.recipeUrl) {
      Linking.openURL(meal.recipeUrl).catch(() => {
        // Silently ignore for now; could surface toast later.
      });
    }
  };

  const handleToggleServed = () => {
    if (isServed) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const handleSelectAction = async (action: ServedAction["value"]) => {
    if (action !== "served") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(false);
      try {
        await onSelectOutcome?.(action);
      } catch (error) {
        console.warn("[TodayCard] Failed to log outcome", error);
      }
      return;
    }

    const message = celebrationMessage ?? getRandomCelebrationMessage();
    setCelebrationMessage(message);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    try {
      await onMarkServed?.(message);
    } catch (error) {
      console.warn("[TodayCard] Failed to mark served", error);
    }
  };
  const toggleIconName: keyof typeof MaterialCommunityIcons.glyphMap = isExpanded
    ? "chevron-up"
    : "chevron-down";

  return (
    <View style={styles.card}>
      {celebrationMessage ? (
        <View style={styles.celebrationBanner}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <View style={styles.celebrationTextContainer}>
            <Text style={styles.celebrationTitle}>Nice work!</Text>
            <Text style={styles.celebrationMessage}>{celebrationMessage}</Text>
          </View>
        </View>
      ) : (
        <>
          <Pressable
            style={styles.touchArea}
            accessibilityRole={meal.recipeUrl ? "button" : "text"}
            accessibilityLabel={
              meal.recipeUrl
                ? `Open recipe for ${meal.title}`
                : `Meal details for ${meal.title}`
            }
            onPress={meal.recipeUrl ? handleCardPress : undefined}
          >
            <View style={styles.topRow}>
              <Text style={styles.date}>{dateLabel}</Text>
              <View style={styles.topRowMeta}>
                {meal.isFavorite ? (
                  <View style={styles.freezerBadge}>
                    <MaterialCommunityIcons
                      name="snowflake"
                      size={14}
                      color={theme.color.accent}
                    />
                    <Text style={styles.freezerBadgeText}>Freezer</Text>
                  </View>
                ) : meal.recipeUrl ? (
                  <View style={styles.recipeTag}>
                    <Text style={styles.recipeTagText}>Recipe</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Text style={styles.emoji} accessibilityLabel={`${meal.title} meal`}>
              {meal.emoji}
            </Text>

            <Text style={styles.title}>{meal.title}</Text>
            {prepNotesToShow ? (
              <Text style={styles.notes}>{prepNotesToShow}</Text>
            ) : null}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.servedButton,
              isServed && styles.servedButtonCompleted,
              pressed && !isServed && styles.servedButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mark meal as served"
            onPress={handleToggleServed}
            disabled={isServed}
          >
            <MaterialCommunityIcons
              name={isServed ? "check-decagram" : "check-circle"}
              size={20}
              color={theme.color.ink}
            />
            <Text style={styles.servedButtonText}>
              {isServed ? "Served and celebrating" : "Served"}
            </Text>
            <MaterialCommunityIcons
              name={toggleIconName as any}
              size={18}
              color={theme.color.ink}
            />
          </Pressable>

          {isExpanded ? (
            <View style={styles.drawer}>
              {SERVED_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    styles.drawerButton,
                    pressed && styles.drawerButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => handleSelectAction(action.value)}
                >
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={18}
                    color={theme.color.ink}
                  />
                  <Text style={styles.drawerButtonText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
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
    celebrationBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      backgroundColor: theme.color.success,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
    },
    celebrationEmoji: {
      fontSize: 28,
    },
    celebrationTextContainer: {
      flex: 1,
      gap: theme.space.xs,
    },
    celebrationTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    celebrationMessage: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
    },
    touchArea: {
      alignItems: "center",
      gap: theme.space.sm,
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
    recipeTag: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    recipeTagText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    topRowMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    freezerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.space.xs,
      paddingVertical: 2,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    freezerBadgeText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    emoji: {
      fontSize: 48,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    notes: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    servedButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      backgroundColor: theme.color.success,
      borderRadius: theme.radius.full,
      paddingVertical: theme.space.md,
    },
    servedButtonPressed: {
      opacity: 0.85,
    },
    servedButtonCompleted: {
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    servedButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    drawer: {
      gap: theme.space.sm,
    },
    drawerButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    drawerButtonPressed: {
      opacity: 0.9,
    },
    drawerButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
  });

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
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

type TodayCardProps = {
  meal: Meal;
  dateLabel: string;
  notes?: string;
};

const SERVED_ACTIONS = [
  { icon: "check-circle", label: "Cooked as planned" },
  { icon: "refresh", label: "Cooked something else" },
  { icon: "silverware-fork-knife", label: "Ate out" },
  { icon: "close-circle", label: "Skipped dinner" },
] as const;

export default function TodayCard({
  meal,
  dateLabel,
  notes,
}: TodayCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isExpanded, setExpanded] = useState(false);

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.touchArea}
        accessibilityRole="button"
        accessibilityLabel={`Open recipe for ${meal.title}`}
        onPress={handleCardPress}
      >
        <View style={styles.topRow}>
          <Text style={styles.date}>{dateLabel}</Text>
          <View style={styles.recipeTag}>
            <Text style={styles.recipeTagText}>Recipe</Text>
          </View>
        </View>

        <Text style={styles.emoji} accessibilityLabel={`${meal.title} meal`}>
          {meal.emoji}
        </Text>

        <Text style={styles.title}>{meal.title}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.servedButton,
          pressed && styles.servedButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mark meal as served"
        onPress={handleToggleServed}
      >
        <MaterialCommunityIcons
          name="check-circle"
          size={20}
          color={theme.color.ink}
        />
        <Text style={styles.servedButtonText}>Served</Text>
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
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


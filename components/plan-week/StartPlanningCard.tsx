import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Props = {
  dayDisplayName: string;
  onGetSuggestions: () => void;
};

export default function StartPlanningCard({
  dayDisplayName,
  onGetSuggestions,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>✨🍽️</Text>
      <Text style={styles.title}>Ready to plan your {dayDisplayName}?</Text>
      <Text style={styles.body}>
        We’ll suggest meals that match your Day Pins, or you can pick one
        yourself.
      </Text>
      <Pressable
        onPress={onGetSuggestions}
        accessibilityRole="button"
        accessibilityLabel="Get suggestions"
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>✨ Get Suggestions</Text>
      </Pressable>
      <Text style={styles.footer}>You can always adjust pins later.</Text>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      alignItems: "center",
      gap: theme.space.md,
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
    body: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      textAlign: "center",
    },
    button: {
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space["2xl"],
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    footer: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
  });

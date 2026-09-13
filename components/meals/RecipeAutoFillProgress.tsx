import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

export default function RecipeAutoFillProgress({ compact = false, complete = false }: { compact?: boolean; complete?: boolean }) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [completedLoadingSteps, setCompletedLoadingSteps] = useState(0);
  useEffect(() => {
    const findingTimer = setTimeout(() => setCompletedLoadingSteps(1), 350);
    const ingredientsTimer = setTimeout(() => setCompletedLoadingSteps(2), 1100);
    return () => { clearTimeout(findingTimer); clearTimeout(ingredientsTimer); };
  }, []);
  const visibleSteps = complete ? 3 : completedLoadingSteps;
  const loadingItems = ["Finding the recipe", "Adding ingredients", "Organizing your grocery list"];
  return (
    <View style={[styles.loadingContent, compact && styles.compact]}>
      <View style={styles.loadingMagicIcon}>
        <MaterialCommunityIcons
          name="magic-staff"
          size={58}
          color={theme.color.accent}
        />
      </View>
      <Text style={styles.loadingTitle}>Creating your meal…</Text>
      <View style={styles.loadingChecklist}>
        {loadingItems.map((label, index) => {
          const stepComplete = visibleSteps > index;
          return (
            <View style={styles.loadingRow} key={label}>
              <MaterialCommunityIcons
                name={stepComplete ? "check-circle" : "circle-outline"}
                size={21}
                color={stepComplete ? theme.color.accent : theme.color.border}
              />
              <Text style={styles.loadingRowText}>{label}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.loadingTrack}>
        <View
          style={[
            styles.loadingProgress,
            { width: `${Math.max(12, visibleSteps * 33.333)}%` },
          ]}
        />
      </View>
      <Text style={styles.loadingHelper}>This may take a few seconds</Text>
    </View>
  );
}
const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  compact: { flex: 0, paddingHorizontal: theme.space.xs, paddingBottom: theme.space.md },
    loadingContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space["2xl"],
      paddingBottom: 72,
    },
    loadingMagicIcon: {
      width: 96,
      height: 96,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.space.lg,
    },
    loadingTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xl,
      textAlign: "center",
    },
    loadingChecklist: {
      width: "100%",
      maxWidth: 320,
      gap: theme.space.lg,
      marginBottom: theme.space.xl,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    loadingRowText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    loadingTrack: {
      width: "100%",
      maxWidth: 320,
      height: 7,
      overflow: "hidden",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    loadingProgress: {
      height: "100%",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    loadingHelper: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      marginTop: theme.space.md,
    },
});

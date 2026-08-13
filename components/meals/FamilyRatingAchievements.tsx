import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Props = {
  isFamilyStar: boolean;
  isGalaxyMeal: boolean;
};

export default function FamilyRatingAchievements({
  isFamilyStar,
  isGalaxyMeal,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!isFamilyStar) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="star" size={17} color="#FEC107" />
        <Text style={[styles.title, styles.familyStarTitle]} numberOfLines={1}>Family Star</Text>
        <Text style={styles.divider}>|</Text>
        <Text style={styles.message}>Everyone loved this meal!</Text>
      </View>
      {isGalaxyMeal ? (
        <View style={styles.row}>
          <MaterialCommunityIcons name="creation" size={17} color="#8B5CF6" />
          <Text style={[styles.title, styles.galaxyTitle]} numberOfLines={1}>Galaxy Meal</Text>
          <Text style={styles.divider}>|</Text>
          <Text style={styles.message}>Your most-served Family Star meal</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    title: { width: 96, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    familyStarTitle: { color: "#FEC107" },
    galaxyTitle: { color: "#8B5CF6" },
    divider: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
    message: { flex: 1, color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  });

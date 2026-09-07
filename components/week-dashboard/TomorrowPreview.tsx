import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import MealEmoji from "../emoji/MealEmoji";

export default function TomorrowPreview({ day }: { day?: WeekPlanDay }) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!day?.meal) return null;
  const isEatOut = day.mealId === EAT_OUT_MEAL_ID;
  const eatOutNote =
    isEatOut && day.meal.title !== EAT_OUT_MEAL.title
      ? day.meal.title.trim()
      : "";
  return (
    <View style={styles.section}>
      <Text style={styles.label}>TOMORROW</Text>
      <View style={styles.row}>
        {isEatOut ? (
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={26}
            color={theme.color.accent}
          />
        ) : (
          <MealEmoji value={day.meal.emoji} size={26} />
        )}
        <View style={styles.copy}>
          <Text style={styles.title}>{isEatOut ? "Eat Out" : day.meal.title}</Text>
          {eatOutNote || day.sides.length ? (
            <Text style={styles.meta}>{eatOutNote || day.sides.join(" · ")}</Text>
          ) : null}
        </View>
        {day.meal?.isFavorite ? (
          <MaterialCommunityIcons name="snowflake" size={18} color={theme.color.accent} />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  section: { gap: theme.space.sm, paddingHorizontal: theme.space.xs },
  label: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingVertical: theme.space.sm },
  emoji: { fontSize: 26 },
  copy: { flex: 1, gap: 2 },
  title: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  meta: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
});

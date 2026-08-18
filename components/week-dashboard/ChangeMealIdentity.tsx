import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import MealEmoji from "../emoji/MealEmoji";

export default function ChangeMealIdentity({
  meal,
  sides = [],
}: {
  meal: Meal;
  sides?: string[];
}) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEatOut = meal.id === EAT_OUT_MEAL_ID;
  const eatOutNote =
    isEatOut && meal.title !== EAT_OUT_MEAL.title ? meal.title.trim() : "";
  const subtitle = eatOutNote || (!isEatOut ? sides.join(" · ") : "");

  return (
    <View style={styles.identity}>
      <View style={styles.iconSlot}>
        {isEatOut ? (
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={23}
            color={theme.color.accent}
          />
        ) : (
          <MealEmoji value={meal.emoji} size={28} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {isEatOut ? "Eat Out" : meal.title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    identity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    iconSlot: {
      width: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: { fontSize: 24 },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
  });

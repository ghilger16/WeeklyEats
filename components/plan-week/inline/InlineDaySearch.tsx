import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import MealEmoji from "../../emoji/MealEmoji";
import { ServedMealEntry } from "../../../stores/servedMealsStorage";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { isSpecialMealId } from "../../../types/specialMeals";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import { getUsualMealsForDay } from "./getUsualMealsForDay";

type Props = {
  day: PlannedWeekDayKey;
  meals: Meal[];
  history: ServedMealEntry[];
  assignedMeal: Meal | null;
  onSelectMeal: (meal: Meal) => void;
  onAddNewMeal?: () => void;
  onSelectEatOut: () => void;
  onSelectFlexNight: () => void;
  onEditSides: () => void;
  onViewDetails: () => void;
  onRemove: () => void;
  onExpandedLayout: () => void;
  autoFocus?: boolean;
};

export default function InlineDaySearch({
  day,
  meals,
  history,
  assignedMeal,
  onSelectMeal,
  onAddNewMeal,
  onSelectEatOut,
  onSelectFlexNight,
  onEditSides,
  onViewDetails,
  onRemove,
  onExpandedLayout,
  autoFocus = true,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, day]);

  const resultMeals = useMemo(
    () =>
      normalizedQuery
        ? meals.filter((meal) =>
            meal.title.toLowerCase().includes(normalizedQuery),
          )
        : getUsualMealsForDay(
            day,
            meals.filter((meal) => meal.id !== assignedMeal?.id),
            history,
          ),
    [assignedMeal?.id, day, history, meals, normalizedQuery],
  );

  return (
    <View style={styles.content} onLayout={onExpandedLayout}>
      <View style={styles.searchField}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={theme.color.subtleInk}
        />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search meals…"
          placeholderTextColor={theme.color.subtleInk}
          accessibilityLabel={`Search meals for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
          returnKeyType="search"
          style={styles.input}
        />
      </View>

      {!normalizedQuery ? (
        <>
          <Text style={styles.sectionTitle}>Quick Picks</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickOptions}
            keyboardShouldPersistTaps="handled"
          >
            {assignedMeal && !isSpecialMealId(assignedMeal.id) ? (
              <QuickOption
                icon="card-text-outline"
                label="Details"
                accessibilityLabel={`View details for ${assignedMeal.title}`}
                onPress={onViewDetails}
                styles={styles}
                theme={theme}
              />
            ) : null}
            {assignedMeal && !isSpecialMealId(assignedMeal.id) ? (
              <QuickOption
                icon="food-variant"
                label="Sides"
                accessibilityLabel={`Edit sides for ${assignedMeal.title}`}
                onPress={onEditSides}
                styles={styles}
                theme={theme}
              />
            ) : null}
            {assignedMeal ? (
              <QuickOption
                icon="delete-outline"
                label="Remove"
                accessibilityLabel={`Remove ${assignedMeal.title} from ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                onPress={onRemove}
                destructive
                styles={styles}
                theme={theme}
              />
            ) : null}
            {onAddNewMeal ? (
              <QuickOption
                icon="plus-circle-outline"
                label="Add New Meal"
                accessibilityLabel={`Add a new meal for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                onPress={onAddNewMeal}
                accent
                styles={styles}
                theme={theme}
              />
            ) : null}
            <QuickOption
              icon="silverware-fork-knife"
              label="Eat Out"
              onPress={onSelectEatOut}
              styles={styles}
              theme={theme}
            />
            <QuickOption
              icon="sync"
              label="Flex Night"
              onPress={onSelectFlexNight}
              styles={styles}
              theme={theme}
            />
          </ScrollView>
          <View style={styles.divider} />
        </>
      ) : null}
      <Text style={styles.sectionTitle}>
        {normalizedQuery
          ? "Search Results"
          : `${PLANNED_WEEK_DISPLAY_NAMES[day]} Favorites`}
      </Text>
      {resultMeals.length ? (
        <View>
          {resultMeals.map((meal) => (
            <Pressable
              key={meal.id}
              onPress={() => {
                Keyboard.dismiss();
                onSelectMeal(meal);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Plan ${meal.title} for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
              style={({ pressed }) => [
                styles.mealRow,
                pressed && styles.pressed,
              ]}
            >
              <MealEmoji value={meal.emoji} size={26} />
              <Text numberOfLines={1} style={styles.mealTitle}>
                {meal.title}
              </Text>
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={theme.color.accent}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No meals found</Text>
      )}
    </View>
  );
}

function QuickOption({
  icon,
  label,
  accessibilityLabel,
  onPress,
  destructive = false,
  accent = false,
  styles,
  theme,
}: {
  icon:
    | "silverware-fork-knife"
    | "sync"
    | "food-variant"
    | "card-text-outline"
    | "plus-circle-outline"
    | "delete-outline";
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  destructive?: boolean;
  accent?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: WeeklyTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Plan ${label}`}
      style={({ pressed }) => [
        styles.quickOption,
        destructive && styles.quickOptionDestructive,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={27}
        color={
          destructive
            ? theme.color.danger
            : accent
              ? theme.color.accent
              : theme.color.ink
        }
      />
      <Text
        style={[
          styles.quickOptionText,
          destructive && styles.quickOptionTextDestructive,
          accent && styles.quickOptionTextAccent,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  content: { paddingHorizontal: theme.space.sm, paddingBottom: theme.space.sm, gap: theme.space.sm },
  searchField: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingHorizontal: theme.space.md, borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  input: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base, paddingVertical: theme.space.sm },
  sectionTitle: { marginTop: theme.space.xs, color: theme.color.subtleInk, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold, letterSpacing: 0.4 },
  quickOptions: { flexDirection: "row", gap: theme.space.sm },
  quickOption: { width: 108, minHeight: 76, alignItems: "center", justifyContent: "center", gap: theme.space.xs, borderRadius: theme.radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surfaceAlt },
  quickOptionDestructive: { borderColor: theme.color.danger },
  quickOptionText: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  quickOptionTextDestructive: { color: theme.color.danger },
  quickOptionTextAccent: { color: theme.color.accent },
  divider: { height: StyleSheet.hairlineWidth, marginTop: theme.space.xs, backgroundColor: theme.color.border },
  mealRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  mealEmoji: { width: 32, textAlign: "center", fontSize: 22 },
  mealTitle: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  empty: { minHeight: 48, textAlignVertical: "center", color: theme.color.subtleInk, fontSize: theme.type.size.base },
  pressed: { opacity: 0.7 },
});

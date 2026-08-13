import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { useMeals } from "../../hooks/useMeals";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { setFamilyRatingValue } from "../../utils/familyRatings";
import FreezerAmountModal from "../meals/FreezerAmountModal";
import FamilyRatingRow from "../meals/FamilyRatingRow";

type Props = {
  day: WeekPlanDay | null;
  servedEntry?: ServedMealEntry;
  onClose: () => void;
  onMarkServed: (day: WeekPlanDay) => void;
  onChangeMeal: (day: WeekPlanDay) => void;
  onEatOut: (day: WeekPlanDay) => void;
  onViewMeal: (day: WeekPlanDay) => void;
  onUndoServed: (
    day: WeekPlanDay,
    entry: ServedMealEntry,
  ) => Promise<void> | void;
};

export default function MealRowDetailsSheet({
  day,
  servedEntry,
  onClose,
  onMarkServed,
  onChangeMeal,
  onEatOut,
  onViewMeal,
  onUndoServed,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { updateMeal } = useMeals();
  const { members } = useFamilyMembers();
  const [isFreezerVisible, setFreezerVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 520,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      onClose();
    });
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) =>
          translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 0.8) dismiss();
          else
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
        },
      }),
    [translateY],
  );
  if (!day?.meal) return null;
  const meal = day.meal;
  const isServed = servedEntry?.outcome === "served";
  const date = day.plannedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const act = (callback: (value: WeekPlanDay) => void) => {
    callback(day);
    onClose();
  };
  const action = (
    label: string,
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    callback: () => void,
    primary = false,
  ) => (
    <Pressable
      onPress={callback}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary && styles.primaryAction,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={primary ? "#FFFFFF" : theme.color.subtleInk}
      />
      <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="slide" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Close meal details" />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
          <View style={styles.dateRow}>
            <Text style={styles.date}>{date.toUpperCase()}</Text>
            <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close meal details" style={styles.close}>
              <MaterialCommunityIcons name="close" size={25} color={theme.color.ink} />
            </Pressable>
          </View>
          <View style={styles.mealHeader}>
            <Text style={styles.emoji}>{meal.emoji || "🍽️"}</Text>
            <View style={styles.mealCopy}>
              <Text style={styles.title}>{meal.title}</Text>
              {meal.prepNotes?.trim() ? <Text style={styles.description}>{meal.prepNotes.trim()}</Text> : null}
            </View>
          </View>
          {isServed ? (
            <View style={styles.servedStatus}>
              <MaterialCommunityIcons name="check-circle" size={32} color={theme.color.success} />
              <Text style={styles.servedStatusText}>
                Served on {day.plannedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </Text>
            </View>
          ) : day.sides.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SIDES</Text>
              <View style={styles.chips}>
                {day.sides.map((side) => <Text key={side.toLowerCase()} style={styles.chip}>{side}</Text>)}
              </View>
            </View>
          ) : null}
          {isServed && members.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FAMILY RATING</Text>
              <FamilyRatingRow
                ratings={meal.familyRatings}
                onChange={(memberId, rating) =>
                  updateMeal({
                    id: meal.id,
                    familyRatings: setFamilyRatingValue(
                      meal.familyRatings,
                      memberId,
                      rating,
                    ),
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIONS</Text>
            <View style={styles.actions}>
              {isServed ? (
                <>
                  {action("View Meal Details", "file-document-outline", () => act(onViewMeal))}
                  {action("Add to Freezer", "snowflake", () => setFreezerVisible(true))}
                  {action("Add Prep Note", "note-edit-outline", () => act(onViewMeal))}
                </>
              ) : day.status === "today"
                ? action(
                    "Mark as Served",
                    "calendar-check",
                    () => act(onMarkServed),
                    true,
                  )
                : null}
              {isServed ? null : action("Change Meal", "swap-horizontal", () => act(onChangeMeal))}
              {isServed ? null : action("Eat Out Instead", "silverware-fork-knife", () => act(onEatOut))}
            </View>
          </View>
          {!isServed ? <View style={styles.divider} /> : null}
          {!isServed ? <View style={styles.section}>
            <Text style={styles.sectionLabel}>QUICK LINKS</Text>
            <View style={styles.actions}>
              {meal.recipeUrl?.trim()
                ? action("View Recipe", "link-variant", () => Linking.openURL(meal.recipeUrl!.trim()).catch(() => {}))
                : null}
              {action("View Meal Details", "file-document-outline", () => act(onViewMeal))}
            </View>
          </View> : null}
          {isServed && servedEntry ? (
            <Pressable
              onPress={async () => {
                await onUndoServed(day, servedEntry);
                onClose();
              }}
              style={({ pressed }) => [styles.undoAction, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Undo served"
            >
              <MaterialCommunityIcons name="undo" size={22} color={theme.color.danger} />
              <Text style={styles.undoText}>Undo Served</Text>
            </Pressable>
          ) : null}
          </ScrollView>
        </Animated.View>
        <FreezerAmountModal
          visible={isFreezerVisible}
          initialMeal={meal}
          initialAmount={meal.freezerAmount ?? meal.freezerQuantity ?? ""}
          initialUnit={meal.freezerUnit}
          initialAddedAt={meal.freezerAddedAt}
          onDismiss={() => setFreezerVisible(false)}
          onComplete={(targetMeal, amount, unit, addedAt) => {
            updateMeal({
              id: targetMeal.id,
              isFavorite: true,
              freezerAmount: amount,
              freezerUnit: unit,
              freezerAddedAt: addedAt,
              updatedAt: new Date().toISOString(),
            });
            setFreezerVisible(false);
          }}
        />
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: { maxHeight: "92%", backgroundColor: theme.color.bg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  sheetContent: { paddingBottom: theme.space["2xl"], gap: theme.space.lg },
  handle: { width: 58, height: 5, borderRadius: theme.radius.full, backgroundColor: theme.color.subtleInk, opacity: 0.65, alignSelf: "center", marginBottom: theme.space.lg },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold, letterSpacing: 0.9 },
  close: { width: 44, height: 44, borderRadius: theme.radius.full, backgroundColor: theme.color.surface, alignItems: "center", justifyContent: "center" },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: theme.space.lg },
  emoji: { fontSize: 46 },
  mealCopy: { flex: 1, gap: theme.space.xs },
  title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
  description: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
  servedStatus: { minHeight: 70, borderRadius: theme.radius.lg, paddingHorizontal: theme.space.lg, flexDirection: "row", alignItems: "center", gap: theme.space.md, backgroundColor: theme.mode === "dark" ? "rgba(0,255,156,0.08)" : "rgba(16,185,129,0.08)" },
  servedStatusText: { color: theme.color.success, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  section: { gap: theme.space.md },
  sectionLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  chip: { color: theme.color.ink, fontSize: theme.type.size.sm, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm, borderRadius: theme.radius.full, backgroundColor: theme.color.surface },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  actions: { gap: theme.space.sm },
  action: { minHeight: 56, borderRadius: theme.radius.lg, backgroundColor: theme.color.surface, flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg },
  primaryAction: { backgroundColor: theme.color.accent },
  actionText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  primaryActionText: { color: "#FFFFFF", fontWeight: theme.type.weight.bold },
  undoAction: { minHeight: 56, borderRadius: theme.radius.lg, backgroundColor: theme.mode === "dark" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)", flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg, marginTop: theme.space.sm },
  undoText: { color: theme.color.danger, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  pressed: { opacity: 0.76 },
});

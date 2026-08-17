import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  LayoutAnimation,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
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
import { EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import { IngredientType, MealIngredient } from "../../types/meals";
import MealEmoji from "../emoji/MealEmoji";

const SHEET_HIDDEN_TRANSLATE = Dimensions.get("window").height;

type ReadOnlyIngredient = {
  name: string;
  ingredientType: IngredientType;
};

const normalizeIngredient = (
  ingredient: MealIngredient,
): ReadOnlyIngredient | null => {
  if (typeof ingredient === "string") {
    const name = ingredient.trim();
    return name ? { name, ingredientType: "keyIngredient" } : null;
  }
  const name = ingredient.name?.trim();
  if (!name) return null;
  return {
    name,
    ingredientType:
      ingredient.ingredientType === "pantryStaple"
        ? "pantryStaple"
        : "keyIngredient",
  };
};

const formatIngredientName = (name: string) =>
  name.replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateY = useRef(
    new Animated.Value(SHEET_HIDDEN_TRANSLATE),
  ).current;
  const isDismissingRef = useRef(false);
  const ingredients = useMemo(
    () =>
      (day?.meal?.ingredients ?? [])
        .map(normalizeIngredient)
        .filter((ingredient): ingredient is ReadOnlyIngredient =>
          Boolean(ingredient),
        ),
    [day?.meal?.ingredients],
  );
  const keyIngredients = useMemo(
    () =>
      ingredients.filter(
        (ingredient) => ingredient.ingredientType === "keyIngredient",
      ),
    [ingredients],
  );
  const pantryStaples = useMemo(
    () =>
      ingredients.filter(
        (ingredient) => ingredient.ingredientType === "pantryStaple",
      ),
    [ingredients],
  );
  const hasIngredients = ingredients.length > 0;
  const shouldAutoExpandIngredients =
    day?.status === "today" &&
    servedEntry?.outcome !== "served" &&
    hasIngredients;
  const [ingredientsExpanded, setIngredientsExpanded] = useState(
    shouldAutoExpandIngredients,
  );

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setIngredientsExpanded(shouldAutoExpandIngredients);
  }, [day?.key, day?.mealId, shouldAutoExpandIngredients]);

  useEffect(() => {
    translateY.stopAnimation();
    isDismissingRef.current = false;
    if (!day?.meal) {
      translateY.setValue(SHEET_HIDDEN_TRANSLATE);
      return;
    }
    translateY.setValue(SHEET_HIDDEN_TRANSLATE);
    Animated.timing(translateY, {
      toValue: 0,
      duration: reduceMotion ? 0 : 240,
      useNativeDriver: true,
    }).start();
  }, [day?.key, day?.mealId, translateY]);

  const closeSheet = () => {
    setIngredientsExpanded(false);
    onClose();
  };

  const dismiss = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    Animated.timing(translateY, {
      toValue: SHEET_HIDDEN_TRANSLATE,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    }).start(() => {
      closeSheet();
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
  const isEatOut = day.mealId === EAT_OUT_MEAL_ID;
  const mealDisplayTitle = isEatOut ? "Eat Out" : meal.title;
  const mealHeaderIcon = isEatOut ? (
    <View style={styles.emojiIconSlot}>
      <MaterialCommunityIcons
        name="silverware-fork-knife"
        size={34}
        color={theme.color.accent}
      />
    </View>
  ) : (
    <MealEmoji value={meal.emoji} size={52} />
  );
  const isServed = servedEntry?.outcome === "served";
  const isPending =
    day.status === "past" &&
    !servedEntry &&
    day.mealId !== EAT_OUT_MEAL_ID;
  const date = day.plannedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const act = (callback: (value: WeekPlanDay) => void) => {
    callback(day);
    closeSheet();
  };
  const toggleIngredients = () => {
    if (!hasIngredients) return;
    if (!reduceMotion) {
      LayoutAnimation.configureNext({
        duration: 240,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
    }
    setIngredientsExpanded((current) => !current);
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
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
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
          {hasIngredients ? (
            <Pressable
              onPress={toggleIngredients}
              accessibilityRole="button"
              accessibilityLabel={`${mealDisplayTitle} ingredients`}
              accessibilityHint={`${ingredientsExpanded ? "Collapse" : "Expand"} ingredient list`}
              accessibilityState={{ expanded: ingredientsExpanded }}
              style={({ pressed }) => [
                styles.mealHeader,
                pressed && styles.headerPressed,
              ]}
            >
              {mealHeaderIcon}
              <View style={styles.mealCopy}>
                <Text style={styles.title}>{mealDisplayTitle}</Text>
                {meal.prepNotes?.trim() ? <Text style={styles.description}>{meal.prepNotes.trim()}</Text> : null}
              </View>
              <MaterialCommunityIcons
                name={ingredientsExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color={theme.color.subtleInk}
              />
            </Pressable>
          ) : (
            <View style={styles.mealHeader}>
              {mealHeaderIcon}
              <View style={styles.mealCopy}>
                <Text style={styles.title}>{mealDisplayTitle}</Text>
                {meal.prepNotes?.trim() ? <Text style={styles.description}>{meal.prepNotes.trim()}</Text> : null}
              </View>
            </View>
          )}
          {ingredientsExpanded ? (
            <View style={styles.ingredientSection}>
              {keyIngredients.length ? (
                <View style={styles.ingredientGroup}>
                  <Text style={styles.ingredientGroupLabel}>KEY INGREDIENTS</Text>
                  <View style={styles.ingredientRows}>
                    {keyIngredients.map((ingredient, index) => (
                      <View
                        key={`key-${ingredient.name.toLocaleLowerCase()}-${index}`}
                        style={styles.ingredientRow}
                      >
                        <Text style={styles.ingredientText}>
                          {formatIngredientName(ingredient.name)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {pantryStaples.length ? (
                <View style={styles.ingredientGroup}>
                  <Text style={styles.ingredientGroupLabel}>PANTRY STAPLES</Text>
                  <View style={styles.ingredientRows}>
                    {pantryStaples.map((ingredient, index) => (
                      <View
                        key={`pantry-${ingredient.name.toLocaleLowerCase()}-${index}`}
                        style={styles.ingredientRow}
                      >
                        <Text style={styles.ingredientText}>
                          {formatIngredientName(ingredient.name)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
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
              ) : isPending
                ? action(
                    "Mark as Served",
                    "calendar-check",
                    () => act(onMarkServed),
                    true,
                  )
                : null}
              {isServed ? null : action("Change Meal", "swap-horizontal", () => act(onChangeMeal))}
              {isServed || isEatOut
                ? null
                : action("Eat Out Instead", "silverware-fork-knife", () =>
                    act(onEatOut),
                  )}
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
                closeSheet();
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
          initialAddedAt={meal.freezerAddedAt}
          onDismiss={() => setFreezerVisible(false)}
          onComplete={(targetMeal, mealAmount, addedAt) => {
            updateMeal({
              id: targetMeal.id,
              isFavorite: true,
              freezerMealAmount: mealAmount,
              freezerAmount: "",
              freezerQuantity: "",
              freezerUnit: "",
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
  headerPressed: { opacity: 0.82 },
  emoji: { fontSize: 46 },
  emojiIconSlot: { width: 50, alignItems: "center", justifyContent: "center" },
  mealCopy: { flex: 1, gap: theme.space.xs },
  title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
  description: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
  ingredientSection: { gap: theme.space.lg },
  ingredientGroup: { gap: theme.space.sm },
  ingredientGroupLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.8 },
  ingredientRows: { gap: theme.space.xs },
  ingredientRow: { minHeight: 38, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.space.sm, paddingVertical: theme.space.xs },
  ingredientText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base },
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

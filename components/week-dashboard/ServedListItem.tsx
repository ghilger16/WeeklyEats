import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import WeekDayListItem from "./WeekDayListItem";
import RatingStars from "../meals/RatingStars";
import { useMeals } from "../../hooks/useMeals";
import FreezerAmountModal from "../meals/FreezerAmountModal";

type ExpandedPanel = "rating" | "freezer" | "notes" | null;

type Props = {
  dayLabel: string;
  meal?: Meal;
  labelOverride?: string;
  emojiOverride?: string;
  iconOverride?: string;
  hideActions?: boolean;
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ServedListItem({
  dayLabel,
  meal,
  labelOverride,
  emojiOverride,
  iconOverride,
  hideActions = false,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { updateMeal } = useMeals();
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [rating, setRating] = useState(meal?.rating ?? 0);
  const [inFreezer, setInFreezer] = useState(Boolean(meal?.isFavorite));
  const [notes, setNotes] = useState("");
  const [isFreezerModalVisible, setFreezerModalVisible] = useState(false);

  useEffect(() => {
    if (hideActions && expanded) {
      setExpanded(null);
    }
  }, [expanded, hideActions]);

  useEffect(() => {
    setInFreezer(Boolean(meal?.isFavorite));
  }, [meal?.isFavorite]);

  const handleToggleFreezer = useCallback(() => {
    if (!meal) {
      return;
    }
    if (!inFreezer) {
      setFreezerModalVisible(true);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInFreezer(false);
    updateMeal({
      id: meal.id,
      isFavorite: false,
    });
  }, [inFreezer, meal, updateMeal]);

  const handleFreezerModalClose = useCallback(() => {
    setFreezerModalVisible(false);
  }, []);

  const handleFreezerModalSave = useCallback(
    (targetMeal: Meal, amount: string, unit: string, addedAt: string) => {
      if (!targetMeal) {
        return;
      }
      updateMeal({
        id: targetMeal.id,
        isFavorite: true,
        freezerAmount: amount,
        freezerUnit: unit,
        freezerAddedAt: addedAt,
      });
      setInFreezer(true);
      setFreezerModalVisible(false);
    },
    [updateMeal]
  );

  const togglePanel = (panel: Exclude<ExpandedPanel, null>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === panel ? null : panel));
  };

  const renderIconButton = (
    icon: string,
    label: string,
    panel: Exclude<ExpandedPanel, null>
  ) => (
    <Pressable
      key={label}
      onPress={() => togglePanel(panel)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        expanded === panel && styles.iconButtonActive,
        pressed && styles.iconButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={18}
        color={expanded === panel ? theme.color.ink : theme.color.subtleInk}
      />
    </Pressable>
  );

  const rightSlot = hideActions
    ? null
    : (
        <>
          {renderIconButton("star", "Rate meal", "rating")}
          {renderIconButton(
            inFreezer ? "check-circle" : "snowflake",
            inFreezer ? "Added to freezer" : "Add to freezer",
            "freezer"
          )}
          {renderIconButton("pencil", "Edit notes", "notes")}
        </>
      );

  return (
    <View>
      <WeekDayListItem
        dayLabel={dayLabel}
        meal={meal}
        rightSlot={rightSlot ?? undefined}
        labelOverride={labelOverride}
        emojiOverride={emojiOverride}
        iconOverride={iconOverride}
      />
      {expanded ? (
        <View style={styles.drawer}>
          {expanded === "rating" ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Rate this meal</Text>
              <RatingStars
                value={rating}
                size={28}
                gap={theme.space.sm}
                onChange={setRating}
              />
            </View>
          ) : null}
          {expanded === "freezer" ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Freezer favorites</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.toggleButton,
                  inFreezer && styles.toggleButtonActive,
                  pressed && styles.toggleButtonPressed,
                ]}
                onPress={handleToggleFreezer}
                accessibilityRole="button"
                accessibilityLabel="Toggle freezer favorite"
              >
                <MaterialCommunityIcons
                  name={inFreezer ? "check" : "plus"}
                  size={18}
                  color={theme.color.ink}
                />
                <Text style={styles.toggleButtonText}>
                  {inFreezer ? "Added to freezer" : "Add to freezer"}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {expanded === "notes" ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Prep notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add notes for next time"
                placeholderTextColor={theme.color.subtleInk}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      <FreezerAmountModal
        mode="edit"
        visible={isFreezerModalVisible}
        initialMeal={meal}
        initialAmount={meal?.freezerAmount ?? meal?.freezerQuantity ?? ""}
        initialUnit={meal?.freezerUnit}
        initialAddedAt={meal?.freezerAddedAt}
        onDismiss={handleFreezerModalClose}
        onComplete={handleFreezerModalSave}
      />
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    iconButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    iconButtonPressed: {
      opacity: 0.9,
    },
    drawer: {
      paddingVertical: theme.space.md,
      paddingLeft: theme.space.md,
      gap: theme.space.md,
    },
    section: {
      gap: theme.space.sm,
    },
    sectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    toggleButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    toggleButtonActive: {
      backgroundColor: theme.color.success,
    },
    toggleButtonPressed: {
      opacity: 0.9,
    },
    toggleButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    notesInput: {
      minHeight: 80,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      textAlignVertical: "top",
    },
  });

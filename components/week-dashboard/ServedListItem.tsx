import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
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

type ExpandedPanel = "rating" | "freezer" | "notes" | null;

type Props = {
  dayLabel: string;
  meal?: Meal;
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ServedListItem({ dayLabel, meal }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [rating, setRating] = useState(meal?.rating ?? 0);
  const [inFreezer, setInFreezer] = useState(Boolean(meal?.isFavorite));
  const [notes, setNotes] = useState("");

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

  const rightSlot = (
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
      <WeekDayListItem dayLabel={dayLabel} meal={meal} rightSlot={rightSlot} />
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
                onPress={() => setInFreezer((prev) => !prev)}
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

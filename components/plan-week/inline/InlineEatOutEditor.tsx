import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { PLANNED_WEEK_DISPLAY_NAMES, PlannedWeekDayKey } from "../../../types/weekPlan";
import { PlanningCalendarEvent } from "../../../utils/calendar-service";
import { getEatOutCalendarSuggestions } from "./eatOutCalendarSuggestions";

type Props = {
  day: PlannedWeekDayKey;
  initialNote?: string;
  calendarEvents: PlanningCalendarEvent[];
  onBack: () => void;
  onSave: (note: string) => void;
  onExpandedLayout: () => void;
};

export default function InlineEatOutEditor({
  day,
  initialNote = "",
  calendarEvents,
  onBack,
  onSave,
  onExpandedLayout,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [note, setNote] = useState(initialNote);
  const dayName = PLANNED_WEEK_DISPLAY_NAMES[day];
  const calendarSuggestions = useMemo(
    () => getEatOutCalendarSuggestions(calendarEvents),
    [calendarEvents],
  );

  return (
    <View style={styles.content} onLayout={onExpandedLayout}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Quick Picks"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={theme.color.subtleInk}
          />
        </Pressable>
        <Text style={styles.title}>Eat Out</Text>
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note (optional)"
        placeholderTextColor={theme.color.subtleInk}
        accessibilityLabel={`Optional note for ${dayName} Eat Out`}
        returnKeyType="done"
        style={styles.input}
      />

      {calendarSuggestions.length ? (
        <View style={styles.calendarSection}>
          <Text style={styles.calendarLabel}>From your calendar</Text>
          <View style={styles.calendarChips}>
            {calendarSuggestions.map((event) => (
              <Pressable
                key={`${event.id}-${event.startDate}`}
                onPress={() => setNote(event.title)}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                style={({ pressed }) => [
                  styles.calendarChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.calendarChipText}>{event.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          onSave(note.trim());
        }}
        accessibilityRole="button"
        accessibilityLabel={`Save Eat Out for ${dayName}`}
        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.color.ink} />
        <Text style={styles.saveText}>Save {dayName}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  content: { paddingHorizontal: theme.space.sm, paddingBottom: theme.space.sm, gap: theme.space.md },
  titleRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: theme.space.md },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  input: { minHeight: 52, paddingHorizontal: theme.space.md, color: theme.color.ink, fontSize: theme.type.size.base, borderRadius: theme.radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surfaceAlt },
  calendarSection: { gap: theme.space.sm },
  calendarLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  calendarChips: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  calendarChip: { minHeight: 44, maxWidth: "100%", paddingHorizontal: theme.space.md, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surfaceAlt },
  calendarChipText: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  saveButton: { minHeight: 52, marginTop: theme.space.sm, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  saveText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  pressed: { opacity: 0.72 },
});

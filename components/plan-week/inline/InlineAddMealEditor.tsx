import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { PLANNED_WEEK_DISPLAY_NAMES, PlannedWeekDayKey } from "../../../types/weekPlan";

type Props = {
  day: PlannedWeekDayKey;
  onBack: () => void;
  onSave: (title: string) => void;
  onExpandedLayout: () => void;
};

export default function InlineAddMealEditor({ day, onBack, onSave, onExpandedLayout }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  const [title, setTitle] = useState("");
  const trimmedTitle = title.trim();
  const dayName = PLANNED_WEEK_DISPLAY_NAMES[day];

  const save = () => {
    if (!trimmedTitle) return;
    Keyboard.dismiss();
    onSave(trimmedTitle);
  };

  return (
    <View style={styles.content} onLayout={onExpandedLayout}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Quick Picks"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.color.subtleInk} />
        </Pressable>
        <Text style={styles.title}>Add Meal</Text>
      </View>

      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        placeholder="Meal title"
        placeholderTextColor={theme.color.subtleInk}
        accessibilityLabel={`New meal title for ${dayName}`}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={save}
        style={styles.input}
      />

      <Pressable
        onPress={save}
        disabled={!trimmedTitle}
        accessibilityRole="button"
        accessibilityLabel={`Save and plan new meal for ${dayName}`}
        style={({ pressed }) => [
          styles.saveButton,
          !trimmedTitle && styles.saveButtonDisabled,
          pressed && trimmedTitle && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.color.ink} />
        <Text style={styles.saveText}>Save &amp; Plan</Text>
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
  saveButton: { minHeight: 52, marginTop: theme.space.sm, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  pressed: { opacity: 0.72 },
});

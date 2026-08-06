import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { PLANNED_WEEK_DISPLAY_NAMES, PlannedWeekDayKey } from "../../../types/weekPlan";
import {
  getSideOptionsForMeal,
  replaceSideWithCustomOption,
} from "./sideOptions";

type Props = {
  day: PlannedWeekDayKey;
  meal: Meal;
  initialSides: string[];
  suggestedSides?: string[];
  onDone: (sides: string[]) => void;
  completionLabel?: string;
  completionAccessibilityLabel?: string;
  onSelectedSidesChange: (sides: string[]) => void;
  onChangeMeal: () => void;
  onExpandedLayout: () => void;
};

const normalize = (value: string) => value.trim().toLowerCase();

export default function InlineSideEditor({
  day,
  meal,
  initialSides,
  suggestedSides = [],
  onDone,
  completionLabel = "Done",
  completionAccessibilityLabel,
  onSelectedSidesChange,
  onChangeMeal,
  onExpandedLayout,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const initialOptions = useMemo(
    () => getSideOptionsForMeal(meal, [...initialSides, ...suggestedSides]),
    [initialSides, meal, suggestedSides],
  );
  const [options, setOptions] = useState(initialOptions);
  const [selectedSides, setSelectedSides] = useState(() => {
    const optionKeys = new Set(initialOptions.map((option) => normalize(option.name)));
    return initialSides.filter((side) => optionKeys.has(normalize(side)));
  });
  const [customSide, setCustomSide] = useState("");
  const inputRef = useRef<TextInput>(null);
  const selectedKeys = useMemo(
    () => new Set(selectedSides.map(normalize)),
    [selectedSides],
  );

  const toggleSide = (side: string) => {
    const key = normalize(side);
    setSelectedSides((current) => {
      const next = current.some((value) => normalize(value) === key)
        ? current.filter((value) => normalize(value) !== key)
        : [...current, side];
      onSelectedSidesChange(next);
      return next;
    });
  };

  const addCustomSide = () => {
    const replacement = replaceSideWithCustomOption(
      options,
      selectedSides,
      customSide,
    );
    if (!replacement) return;
    setOptions(replacement.options);
    setSelectedSides(replacement.selectedSides);
    onSelectedSidesChange(replacement.selectedSides);
    setCustomSide("");
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={styles.content} onLayout={onExpandedLayout}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeading}>
          <Pressable
            onPress={onChangeMeal}
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
          <Text style={styles.sectionTitle}>Suggested Sides</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {options.map((option) => {
          const selected = selectedKeys.has(normalize(option.name));
          return (
            <Pressable
              key={option.name.toLowerCase()}
              onPress={() => toggleSide(option.name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.name}, ${selected ? "selected" : "not selected"}`}
              style={({ pressed }) => [
                styles.sideChip,
                selected && styles.sideChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name={selected ? "check-circle" : "checkbox-blank-circle-outline"}
                size={25}
                color={selected ? theme.color.accent : theme.color.subtleInk}
              />
              <Text numberOfLines={1} style={styles.sideName}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={styles.customInputRow}
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={25} color={theme.color.subtleInk} />
        <TextInput
          ref={inputRef}
          value={customSide}
          onChangeText={setCustomSide}
          onSubmitEditing={addCustomSide}
          placeholder="Add a side…"
          placeholderTextColor={theme.color.subtleInk}
          accessibilityLabel="Add a custom side"
          returnKeyType="done"
          style={styles.input}
        />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={addCustomSide}
          disabled={!customSide.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add custom side"
          accessibilityState={{ disabled: !customSide.trim() }}
          style={({ pressed }) => [
            styles.addButton,
            customSide.trim() && styles.addButtonActive,
            pressed && customSide.trim() && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="plus"
            size={22}
            color={customSide.trim() ? theme.color.ink : theme.color.subtleInk}
          />
          <Text
            style={[
              styles.addText,
              customSide.trim() && styles.addTextActive,
            ]}
          >
            Add
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            onDone(selectedSides);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            completionAccessibilityLabel ??
            `Done editing sides for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`
          }
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="check" size={22} color={theme.color.ink} />
          <Text style={styles.doneText}>{completionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  content: { paddingHorizontal: theme.space.sm, paddingBottom: theme.space.sm, gap: theme.space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleLeading: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full },
  sectionTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  sideChip: { width: "48.5%", minHeight: 56, paddingHorizontal: theme.space.md, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  sideChipSelected: { borderColor: theme.color.accent, backgroundColor: theme.mode === "dark" ? "rgba(255, 75, 145, 0.10)" : "rgba(255, 75, 145, 0.06)" },
  sideName: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base },
  customInputRow: { minHeight: 52, paddingHorizontal: theme.space.md, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: theme.color.cardOutline },
  input: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base, paddingVertical: theme.space.sm },
  actions: { marginTop: theme.space.sm, flexDirection: "row", gap: theme.space.sm },
  addButton: { flex: 1, minHeight: 52, borderRadius: theme.radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border, backgroundColor: theme.color.surfaceAlt, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm, opacity: 0.55 },
  addButtonActive: { borderColor: theme.color.accent, backgroundColor: theme.color.accent, opacity: 1 },
  addText: { color: theme.color.subtleInk, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  addTextActive: { color: theme.color.ink },
  doneButton: { flex: 1, minHeight: 52, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  doneText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  pressed: { opacity: 0.72 },
});

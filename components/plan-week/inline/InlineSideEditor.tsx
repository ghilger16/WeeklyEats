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
import { alpha, WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { PLANNED_WEEK_DISPLAY_NAMES, PlannedWeekDayKey } from "../../../types/weekPlan";
import {
  getSideOptionsForMeal,
  promoteSavedSides,
  replaceSideWithCustomOption,
} from "./sideOptions";

type Props = {
  day: PlannedWeekDayKey;
  meal: Meal;
  initialSides: string[];
  onDone: (sides: string[]) => void;
  completionLabel?: string;
  completionAccessibilityLabel?: string;
  onSelectedSidesChange: (sides: string[]) => void;
  onPreferredSidesChange?: (sides: string[]) => void;
  onChangeMeal: () => void;
  onExpandedLayout: () => void;
};

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export default function InlineSideEditor({
  day,
  meal,
  initialSides,
  onDone,
  completionLabel = "Done",
  completionAccessibilityLabel,
  onSelectedSidesChange,
  onPreferredSidesChange,
  onChangeMeal,
  onExpandedLayout,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const initialOptions = useMemo(
    () => getSideOptionsForMeal(meal, initialSides),
    [initialSides, meal],
  );
  const [options, setOptions] = useState(initialOptions);
  const [selectedSides, setSelectedSides] = useState(() => {
    const optionKeys = new Set(initialOptions.map((option) => normalize(option.name)));
    return initialSides.filter((side) => optionKeys.has(normalize(side)));
  });
  const [customSide, setCustomSide] = useState("");
  const preferredSidesRef = useRef(meal.preferredSides ?? []);
  const inputRef = useRef<TextInput>(null);
  const selectedKeys = useMemo(
    () => new Set(selectedSides.map(normalize)),
    [selectedSides],
  );

  const rememberPreferredSide = (side: string) => {
    const next = promoteSavedSides([side], preferredSidesRef.current);
    preferredSidesRef.current = next;
    onPreferredSidesChange?.(next);
  };

  const toggleSide = (option: { name: string; isCustom: boolean }) => {
    const side = option.name;
    const key = normalize(side);
    const isCurrentlySelected = selectedKeys.has(key);
    if (!isCurrentlySelected) {
      rememberPreferredSide(side);
    }
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
    rememberPreferredSide(customSide);
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
          <Text style={styles.sectionTitle}>Sides</Text>
        </View>
      </View>

      <View style={styles.sideGroup}>
        <Text style={styles.sideGroupLabel}>Suggested Sides</Text>
        <View style={styles.grid}>
          {options.map((option) => {
          const selected = selectedKeys.has(normalize(option.name));
          return (
            <SideChip
              key={option.name.toLowerCase()}
              option={option}
              selected={selected}
              onPress={() => toggleSide(option)}
              styles={styles}
              accent={theme.color.accent}
              accentMuted={alpha(theme.color.accent, 0.58)}
            />
          );
        })}
        </View>
      </View>

      <View style={styles.customInputRow}>
        <TextInput
          ref={inputRef}
          value={customSide}
          onChangeText={setCustomSide}
          onSubmitEditing={addCustomSide}
          placeholder="Add a side…"
          placeholderTextColor={theme.color.subtleInk}
          accessibilityLabel="Add a custom side"
          returnKeyType="done"
          autoCapitalize="words"
          style={styles.input}
        />
        <Pressable
          onPress={addCustomSide}
          accessibilityRole="button"
          accessibilityLabel="Add custom side"
          style={({ pressed }) => [
            styles.customAddButton,
            pressed && customSide.trim() && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="plus"
            size={22}
            color={theme.color.accent}
          />
        </Pressable>
      </View>

      <View style={styles.actions}>
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

type SideChipProps = {
  option: { name: string };
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  accent: string;
  accentMuted: string;
};

const SideChip = ({ option, selected, onPress, styles, accent, accentMuted }: SideChipProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={`${option.name}, ${selected ? "selected" : "not selected"}`}
    style={({ pressed }) => [
      styles.sideChip,
      selected && styles.sideChipSelected,
      pressed && styles.pressed,
    ]}
  >
    <View style={styles.sideChipDot} />
    <Text numberOfLines={1} style={[styles.sideName, selected && styles.sideNameSelected]}>{option.name}</Text>
    <MaterialCommunityIcons
      name={selected ? "check" : "plus"}
      size={15}
      color={selected ? accent : accentMuted}
    />
  </Pressable>
);

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  content: { paddingHorizontal: theme.space.sm, paddingBottom: theme.space.sm, gap: theme.space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleLeading: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full },
  sectionTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  sideGroup: { gap: theme.space.sm },
  sideGroupLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textTransform: "uppercase", letterSpacing: 0.7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  sideChip: { width: "48.5%", height: 44, paddingHorizontal: theme.space.md, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  sideChipSelected: { borderColor: theme.color.accent, backgroundColor: alpha(theme.color.accent, 0.12) },
  sideChipDot: { width: 7, height: 7, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
  sideName: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  sideNameSelected: { color: theme.color.accent },
  customInputRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  input: { flex: 1, minHeight: 48, paddingHorizontal: theme.space.md, color: theme.color.ink, fontSize: theme.type.size.base },
  customAddButton: { width: 44, height: 44, marginRight: theme.space.xs, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
  actions: { marginTop: theme.space.sm, flexDirection: "row", gap: theme.space.sm },
  doneButton: { flex: 1, minHeight: 52, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  doneText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  pressed: { opacity: 0.72 },
});

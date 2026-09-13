import { useCuisineSides } from "../../hooks/useCuisineSides";
import { getCuisineSides } from "../../utils/cuisineSideSuggestions";
import { normalizeCuisineSides, saveCuisineSides } from "../../stores/cuisineSidesStorage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import MealEmoji from "../emoji/MealEmoji";
import { CUISINE_OPTIONS, CuisineType, getCuisineLabel } from "../../types/cuisine";

type Props = {
  visible: boolean;
  selected?: CuisineType | null;
  mealTitle: string;
  mealEmoji?: string;
  onSelect: (cuisine: CuisineType | null) => void;
  onClose: () => void;
  embedded?: boolean;
};

export default function CuisineSelectorModal({ visible, selected, mealTitle, mealEmoji, onSelect, onClose, embedded = false }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const overrides = useCuisineSides();
  const sides = selected ? getCuisineSides(selected, overrides) : [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [newSide, setNewSide] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setDraft([]);
    setNewSide("");
  }, [selected, visible]);

  const canAddSide = !saving && draft.length < 6 && Boolean(newSide.trim()) &&
    !draft.some((side) => side.trim().replace(/\s+/g, " ").toLocaleLowerCase() === newSide.trim().replace(/\s+/g, " ").toLocaleLowerCase());
  const addSide = () => {
    if (!canAddSide) return;
    setDraft((current) => normalizeCuisineSides([...current, newSide]));
    setNewSide("");
  };

  const saveCustomization = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setSaveError(null);
    Keyboard.dismiss();
    try {
      await saveCuisineSides(selected, draft);
      setEditing(false);
    } catch {
      setSaveError("Couldn’t save your sides. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const content = (
      <View style={[styles.backdrop, embedded && styles.embeddedBackdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close cuisine selector" />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Choose a cuisine</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close cuisine selector" style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={21} color={theme.color.subtleInk} />
            </Pressable>
          </View>
          <View style={styles.mealHeader}>
            <View style={styles.mealEmojiContainer}>
              <MealEmoji value={mealEmoji} size={30} />
            </View>
            <Text style={styles.mealTitle} numberOfLines={2}>{mealTitle || "Untitled meal"}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.list}>
            {selected ? (
              <View style={styles.sidesSection}>
                <View style={styles.sidesHeading}>
                  <Text accessibilityRole="header" style={[styles.sectionLabel, styles.sidesLabel]}>
                    Sides for {getCuisineLabel(selected)} · {editing ? normalizeCuisineSides(draft).length : sides.length}
                  </Text>
                  {!editing ? (
                    <Pressable accessibilityRole="button" onPress={() => { setDraft([...sides]); setNewSide(""); setEditing(true); }} hitSlop={8}>
                      <Text style={styles.customizeText}>Customize</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.sidesGrid}>
                  {(editing ? draft : sides).map((side, index) => (
                    <View key={editing ? index : side} style={[styles.sideChip, editing && styles.sideChipEditing]}>
                      {editing ? (
                        <>
                          <TextInput
                            value={side}
                            editable={!saving}
                            accessibilityLabel={`Suggested side ${index + 1}`}
                            placeholder="Side name"
                            placeholderTextColor={theme.color.subtleInk}
                            onChangeText={(text) => setDraft((current) => current.map((value, i) => i === index ? text : value))}
                            style={styles.sideInput}
                            returnKeyType="done"
                          />
                          <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel={`Remove side ${index + 1}`} onPress={() => setDraft((current) => current.filter((_, i) => i !== index))} style={styles.removeButton} hitSlop={6}>
                            <MaterialCommunityIcons name="trash-can-outline" size={19} color={theme.color.accent} />
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <View style={styles.sideChipDot} />
                          <Text numberOfLines={2} style={styles.sideText}>{side}</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
                {editing ? (
                  <>
                    <View style={styles.customInputRow}>
                      <TextInput
                        value={newSide}
                        onChangeText={setNewSide}
                        onSubmitEditing={addSide}
                        editable={!saving}
                        placeholder="Add a side…"
                        placeholderTextColor={theme.color.subtleInk}
                        accessibilityLabel="Add a side"
                        returnKeyType="done"
                        autoCapitalize="words"
                        style={styles.customInput}
                      />
                      <Pressable onPress={addSide} disabled={!canAddSide} accessibilityRole="button" accessibilityLabel="Add custom side" style={[styles.customAddButton, !canAddSide && styles.disabled]}>
                        <MaterialCommunityIcons name="plus" size={22} color={theme.color.accent} />
                      </Pressable>
                    </View>
                    {draft.length >= 6 ? <Text style={styles.limitText}>Six sides maximum. Remove a side to add another.</Text> : null}
                    <View style={styles.editActions}>
                      <Pressable disabled={saving} accessibilityRole="button" onPress={() => { setEditing(false); setSaveError(null); }} style={styles.textAction}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                      <Pressable disabled={saving} accessibilityRole="button" onPress={() => void saveCustomization()} style={styles.textAction}><Text style={styles.customizeText}>{saving ? "Saving…" : "Save"}</Text></Pressable>
                    </View>
                    {saveError ? <Text accessibilityRole="alert" style={styles.saveError}>{saveError}</Text> : null}
                  </>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>All cuisines</Text>
            {CUISINE_OPTIONS.map((option) => {
              const isSelected = selected === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={saving}
                  onPress={() => onSelect(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
                  {isSelected ? <MaterialCommunityIcons name="check" size={21} color={theme.color.accent} /> : null}
                </Pressable>
              );
            })}
            {selected ? (
              <Pressable disabled={saving} onPress={() => onSelect(null)} accessibilityRole="button" style={({ pressed }) => [styles.clearRow, pressed && styles.pressed]}>
                <Text style={styles.clearText}>Clear cuisine</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
  );

  if (embedded) {
    return visible ? content : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
  embeddedBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 20 },
  sheet: { maxHeight: "82%", paddingHorizontal: theme.space.xl, paddingTop: theme.space.md, backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl },
  handle: { width: 40, height: 4, alignSelf: "center", marginBottom: theme.space.lg, borderRadius: theme.radius.full, backgroundColor: theme.color.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.space.lg },
  title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: theme.space.md, marginBottom: theme.space.lg, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  mealEmojiContainer: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md, backgroundColor: theme.color.surface },
  mealEmoji: { fontSize: 27 },
  mealTitle: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  sectionLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: theme.space.sm },
  sidesSection: { gap: theme.space.sm, marginBottom: theme.space.lg },
  sidesHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space.sm },
  sidesLabel: { flex: 1, marginBottom: 0 },
  customizeText: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium },
  sidesGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  sideChip: { width: "48.5%", minHeight: 60, paddingVertical: theme.space.sm, paddingHorizontal: theme.space.md, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.accent },
  sideChipEditing: { paddingHorizontal: theme.space.sm },
  sideChipDot: { width: 7, height: 7, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
  sideText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, lineHeight: 20, fontWeight: theme.type.weight.medium },
  sideInput: { flex: 1, minHeight: 40, color: theme.color.ink, fontSize: theme.type.size.sm, padding: 0 },
  removeButton: { width: 28, minHeight: 40, alignItems: "center", justifyContent: "center" },
  customInputRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  customInput: { flex: 1, minHeight: 48, paddingHorizontal: theme.space.md, color: theme.color.ink, fontSize: theme.type.size.base },
  customAddButton: { width: 44, height: 44, marginRight: theme.space.xs, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
  limitText: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.space.lg },
  textAction: { minHeight: 36, justifyContent: "center" },
  cancelText: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  saveError: { color: theme.color.danger, fontSize: theme.type.size.xs },
  list: { paddingBottom: theme.space.xl },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  rowLabel: { color: theme.color.ink, fontSize: theme.type.size.base },
  rowLabelSelected: { color: theme.color.accent, fontWeight: theme.type.weight.bold },
  clearRow: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: theme.space.md },
  clearText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  pressed: { opacity: 0.7 },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { CUISINE_OPTIONS, CuisineType } from "../../types/cuisine";

type Props = {
  visible: boolean;
  selected?: CuisineType | null;
  mealTitle: string;
  mealEmoji?: string;
  onSelect: (cuisine: CuisineType | null) => void;
  onClose: () => void;
};

export default function CuisineSelectorModal({ visible, selected, mealTitle, mealEmoji, onSelect, onClose }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
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
              <Text style={styles.mealEmoji}>{mealEmoji || "🍽️"}</Text>
            </View>
            <Text style={styles.mealTitle} numberOfLines={2}>{mealTitle || "Untitled meal"}</Text>
          </View>
          <Text style={styles.sectionLabel}>All cuisines</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {CUISINE_OPTIONS.map((option) => {
              const isSelected = selected === option.value;
              return (
                <Pressable
                  key={option.value}
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
              <Pressable onPress={() => onSelect(null)} accessibilityRole="button" style={({ pressed }) => [styles.clearRow, pressed && styles.pressed]}>
                <Text style={styles.clearText}>Clear cuisine</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
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
  list: { paddingBottom: theme.space.xl },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  rowLabel: { color: theme.color.ink, fontSize: theme.type.size.base },
  rowLabelSelected: { color: theme.color.accent, fontWeight: theme.type.weight.bold },
  clearRow: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: theme.space.md },
  clearText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  pressed: { opacity: 0.7 },
});

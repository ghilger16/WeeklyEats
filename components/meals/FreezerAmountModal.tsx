import { MaterialCommunityIcons } from "@expo/vector-icons";
import MealEmoji from "../emoji/MealEmoji";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import {
  formatFreezerMealAmount,
  getFreezerMealAmount,
} from "../../utils/freezerMealAmount";

type Props = {
  visible: boolean;
  initialMeal?: Meal | null;
  initialAmount?: string;
  initialAddedAt?: string;
  onDismiss: () => void;
  onComplete: (meal: Meal, mealAmount: number, addedAt: string) => void;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
};

export default function FreezerAmountModal({
  visible,
  initialMeal,
  initialAmount,
  initialAddedAt,
  onDismiss,
  onComplete,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const meal = initialMeal ?? null;
  const [amount, setAmount] = useState(1);
  const [addedDate, setAddedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const legacyMeal = meal ?? ({ freezerAmount: initialAmount } as Meal);
    setAmount(getFreezerMealAmount(legacyMeal) ?? 1);
    setAddedDate(parseDate(initialAddedAt ?? meal?.freezerAddedAt) ?? new Date());
    setDatePickerVisible(false);
  }, [initialAddedAt, initialAmount, meal, visible]);

  const dateLabel = isToday(addedDate)
    ? "Today"
    : addedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const handleClose = () => {
    setDatePickerVisible(false);
    onDismiss();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPad} onPress={handleClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close Add to Freezer" style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="close" size={22} color={theme.color.ink} />
            </Pressable>
            <Text style={styles.title}>Add to Freezer</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.mealIdentity}>
              <MealEmoji value={meal?.emoji} size={38} />
              <Text style={styles.mealName} numberOfLines={2}>{meal?.title ?? "Meal"}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>How much is in the freezer?</Text>
              <Text style={styles.helper}>1 meal = enough for your family for one dinner</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => setAmount((current) => Math.max(0.5, current - 0.5))} accessibilityRole="button" accessibilityLabel="Decrease freezer meals" style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="minus" size={28} color={theme.color.accent} />
                </Pressable>
                <Text style={styles.amount}>{formatFreezerMealAmount(amount)}</Text>
                <Pressable onPress={() => setAmount((current) => current + 0.5)} accessibilityRole="button" accessibilityLabel="Increase freezer meals" style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="plus" size={28} color={theme.color.accent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Frozen on</Text>
              <Pressable onPress={() => setDatePickerVisible((current) => !current)} accessibilityRole="button" accessibilityLabel={`Frozen on ${dateLabel}`} style={({ pressed }) => [styles.dateRow, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="calendar-month" size={24} color={theme.color.accent} />
                <Text style={styles.dateText}>{dateLabel}</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.accent} />
              </Pressable>
              {isDatePickerVisible ? (
                <View style={styles.datePickerWrap}>
                  {Platform.OS === "web" ? (
                    <Text style={styles.dateText}>{addedDate.toLocaleDateString()}</Text>
                  ) : Platform.OS === "ios" ? (
                    <DateTimePicker
                      value={addedDate}
                      mode="date"
                      display="spinner"
                      textColor={theme.mode === "dark" ? "#FFFFFF" : theme.color.ink}
                      themeVariant={theme.mode}
                      onChange={(_, selectedDate) => {
                        if (selectedDate) setAddedDate(selectedDate);
                      }}
                    />
                  ) : (
                    <DateTimePicker
                      value={addedDate}
                      mode="date"
                      display="calendar"
                      onChange={(_, selectedDate) => {
                        if (selectedDate) setAddedDate(selectedDate);
                        setDatePickerVisible(false);
                      }}
                    />
                  )}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <Pressable
            disabled={!meal}
            onPress={() => meal && onComplete(meal, amount, addedDate.toISOString())}
            accessibilityRole="button"
            accessibilityLabel="Add to Freezer"
            style={({ pressed }) => [styles.primaryButton, !meal && styles.disabled, pressed && meal && styles.pressed]}
          >
            <Text style={styles.primaryText}>Add to Freezer</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.52)" },
  backdropPad: { flex: 1 },
  sheet: { maxHeight: "86%", paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm, paddingBottom: theme.space["2xl"], gap: theme.space.lg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, backgroundColor: theme.color.surface },
  content: { gap: theme.space.lg, paddingBottom: theme.space.sm },
  handle: { width: 42, height: 5, alignSelf: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.border },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  headerSpacer: { width: 44 },
  title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
  mealIdentity: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg },
  mealEmoji: { fontSize: 34 },
  mealName: { flexShrink: 1, color: theme.color.ink, fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold, textAlign: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  section: { gap: theme.space.sm },
  sectionLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  helper: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  stepper: { minHeight: 92, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.space.lg },
  stepButton: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.accent, backgroundColor: theme.color.surfaceAlt },
  amount: { minWidth: 150, color: theme.color.ink, fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold, textAlign: "center" },
  dateRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg, borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  dateText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  datePickerWrap: { alignItems: "center", padding: theme.space.sm, borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceAlt },
  primaryButton: { minHeight: theme.component.button.height, marginTop: theme.space.md, alignItems: "center", justifyContent: "center", borderRadius: theme.component.button.radius, backgroundColor: theme.color.accent },
  primaryText: { color: "#FFFFFF", fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
});

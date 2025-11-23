import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";

const UNIT_OPTIONS = [
  "Servings",
  "Half Serving",
  "Portions",
  "Containers",
  "Leftovers",
  "Cups",
  "Pints",
  "Quarts",
  "Pieces",
  "Ounces",
  "Pounds",
] as const;

const DEFAULT_UNIT = UNIT_OPTIONS[0];

type Props = {
  visible: boolean;
  initialMeal?: Meal | null;
  initialAmount?: string;
  initialUnit?: string;
  initialAddedAt?: string;
  onDismiss: () => void;
  onComplete: (
    meal: Meal,
    amount: string,
    unit: string,
    addedAt: string
  ) => void;
};

export default function FreezerAmountModal({
  visible,
  initialMeal,
  initialAmount,
  initialUnit,
  initialAddedAt,
  onDismiss,
  onComplete,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const meal = initialMeal ?? null;

  const parseAmount = (value?: string): number | null => {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.round(parsed);
  };

  const parseDate = (value?: string | null): Date | null => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };

  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(meal);
  const [amount, setAmount] = useState<number | null>(
    parseAmount(initialAmount)
  );
  const [unit, setUnit] = useState<string>(
    initialUnit && initialUnit.length > 0 ? initialUnit : DEFAULT_UNIT
  );
  const [addedDate, setAddedDate] = useState<Date>(() => new Date());
  const [isDateMode, setIsDateMode] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setIsDateMode(false);
    setSelectedMeal(meal);
    setAmount(parseAmount(initialAmount));
    setUnit(initialUnit && initialUnit.length > 0 ? initialUnit : DEFAULT_UNIT);
    setAddedDate(
      parseDate(initialAddedAt ?? meal?.freezerAddedAt) ?? new Date()
    );
  }, [initialAddedAt, initialAmount, initialUnit, meal, visible]);

  const increment = () =>
    setAmount((prev) => {
      if (prev === null) {
        return 1;
      }
      return prev + 1;
    });
  const decrement = () =>
    setAmount((prev) => {
      if (prev === null) {
        return null;
      }
      const next = Math.max(0, prev - 1);
      return next;
    });

  const handleClose = () => {
    setIsDateMode(false);
    onDismiss();
  };

  const handleSave = () => {
    if (!selectedMeal) {
      return;
    }
    const hasAmount = amount !== null && amount > 0;
    const amountStr = hasAmount ? String(amount) : "";
    const unitStr = hasAmount ? unit : "";
    onComplete(selectedMeal, amountStr, unitStr, addedDate.toISOString());
  };

  const hasAmountValue = amount !== null && amount > 0;
  const amountDisplay =
    amount !== null
      ? `${amount}${unit ? ` ${unit}` : ""}`
      : `0 ${unit && unit.length > 0 ? unit : DEFAULT_UNIT}`;
  const disableSave = !selectedMeal;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPad} onPress={onDismiss} />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.amountContent}>
            <View style={styles.amountBody}>
              <View style={styles.amountHeader}>
                <Pressable
                  onPress={handleClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close freezer amount editor"
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.backButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={theme.color.subtleInk}
                  />
                </Pressable>
                <Text style={styles.amountHeaderTitle}>
                  {isDateMode ? "Set Date Added" : "Set Amount"}
                </Text>
                <Pressable
                  onPress={() => setIsDateMode((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isDateMode ? "Show amount controls" : "Change freezer date"
                  }
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.headerIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isDateMode ? "counter" : "calendar-month"}
                    size={20}
                    color={theme.color.subtleInk}
                  />
                </Pressable>
              </View>
              {selectedMeal ? (
                <>
                  {!isDateMode ? (
                    <Text
                      style={[
                        styles.example,
                        !hasAmountValue && styles.examplePlaceholder,
                      ]}
                    >
                      {amountDisplay}
                    </Text>
                  ) : null}
                  <Text style={styles.mealName}>{selectedMeal.title}</Text>
                </>
              ) : null}
              {isDateMode ? (
                <View style={styles.dateContainer}>
                  <Text style={styles.fieldLabel}>Freezer Date</Text>
                  <View style={styles.datePickerWrapper}>
                    {Platform.OS === "web" ? (
                      <Text style={styles.dateDisplayText}>
                        {addedDate.toLocaleDateString()}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={addedDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "calendar"}
                        onChange={(_, selectedDate) => {
                          if (selectedDate) {
                            setAddedDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </View>
                  {Platform.OS === "web" ? (
                    <Text style={styles.dateHelperText}>
                      Date editing is currently limited on web. It will use the
                      selected date above.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <View style={styles.counterRow}>
                    <Pressable
                      onPress={decrement}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease amount"
                      style={({ pressed }) => [
                        styles.counterButton,
                        pressed && styles.counterButtonPressed,
                      ]}
                    >
                      <Text style={styles.counterButtonText}>-</Text>
                    </Pressable>
                    <Text style={styles.counterValue}>
                      {amount !== null ? amount : 0}
                    </Text>
                    <Pressable
                      onPress={increment}
                      accessibilityRole="button"
                      accessibilityLabel="Increase amount"
                      style={({ pressed }) => [
                        styles.counterButton,
                        pressed && styles.counterButtonPressed,
                      ]}
                    >
                      <Text style={styles.counterButtonText}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <View style={styles.unitGrid}>
                    {UNIT_OPTIONS.map((option) => {
                      const isActive = option === unit;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setUnit(option)}
                          accessibilityRole="button"
                          accessibilityLabel={`Set unit to ${option}`}
                          style={({ pressed }) => [
                            styles.unitChip,
                            isActive && styles.unitChipActive,
                            pressed && styles.unitChipPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitChipText,
                              isActive && styles.unitChipTextActive,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
            <Pressable
              onPress={handleSave}
              disabled={disableSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: disableSave }}
              accessibilityLabel="Save freezer amount"
              style={({ pressed }) => [
                styles.saveButton,
                pressed && !disableSave && styles.saveButtonPressed,
                disableSave && styles.saveButtonDisabled,
              ]}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    backdropPad: {
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.lg,
      paddingBottom: theme.space["2xl"],
      gap: theme.space.lg,
      minHeight: "65%",
      maxHeight: "80%",
    },
    amountContent: {
      flex: 1,
      justifyContent: "space-between",
    },
    amountBody: {
      gap: theme.space.lg,
      flexGrow: 1,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignSelf: "flex-start",
    },
    backButtonPressed: {
      opacity: 0.8,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    headerIconButtonPressed: {
      opacity: 0.85,
    },
    mealName: {
      textAlign: "center",
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    example: {
      textAlign: "center",
      color: theme.color.accent,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    examplePlaceholder: {
      color: theme.color.subtleInk,
    },
    amountHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    amountHeaderTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    amountHeaderSpacer: {
      width: 44,
      height: 44,
    },
    dateContainer: {
      gap: theme.space.md,
    },
    datePickerWrapper: {
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.md,
      alignItems: "center",
      justifyContent: "center",
    },
    dateDisplayText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    dateHelperText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      textAlign: "center",
    },
    fieldLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    counterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.lg,
    },
    counterButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    counterButtonPressed: {
      opacity: 0.85,
    },
    counterButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    counterValue: {
      minWidth: 64,
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    unitGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    unitChip: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    unitChipActive: {
      backgroundColor: theme.color.surface,
      borderColor: theme.color.accent,
    },
    unitChipPressed: {
      opacity: 0.85,
    },
    unitChipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    unitChipTextActive: {
      color: theme.color.accent,
    },
    saveButton: {
      marginTop: theme.space["2xl"],
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonPressed: {
      opacity: 0.85,
    },
    saveButtonDisabled: {
      opacity: 0.45,
    },
    saveButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
  });

export { UNIT_OPTIONS, DEFAULT_UNIT };

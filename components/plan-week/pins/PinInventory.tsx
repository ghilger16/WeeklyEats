import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { DayPinsState, normalizeDayPinsState } from "../../../types/dayPins";
import { renderPin, PinIndicatorVariant } from "../../pins/renderPin";

export type InventoryPinId = PinIndicatorVariant;

type Props = {
  value: DayPinsState;
  onAdd: (id: InventoryPinId) => void;
};

export const PIN_INVENTORY_OPTIONS: Array<{
  id: InventoryPinId;
  title: string;
  subtitle: string;
}> = [
  {
    id: "difficulty",
    title: "Difficulty",
    subtitle: "Lock in effort targets.",
  },
  {
    id: "expense",
    title: "Expense",
    subtitle: "Keep meals on budget.",
  },
  {
    id: "reuse",
    title: "Reuse",
    subtitle: "Spread repeats every few weeks.",
  },
  {
    id: "family",
    title: "Family Star",
    subtitle: "Flag crowd-pleasers.",
  },
  {
    id: "freezer",
    title: "Freezer Night",
    subtitle: "Only suggest freezer-ready meals.",
  },
];

const PinInventory = ({ value, onAdd }: Props) => {
  const normalizedValue = useMemo(() => normalizeDayPinsState(value), [value]);
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const availableOptions = PIN_INVENTORY_OPTIONS.filter(
    (option) => !isInventoryPinActive(option.id, normalizedValue)
  );

  if (!availableOptions.length) {
    return (
      <View style={styles.inventoryCard}>
        <Text style={styles.inventoryTitle}>Pin Inventory</Text>
        <Text style={styles.inventoryEmptyText}>
          All helper pins are active. Edit them from the board above.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.inventoryCard}>
      <View style={styles.inventoryHeader}>
        <Text style={styles.inventoryTitle}>Pin Inventory</Text>
        <Text style={styles.inventorySubtitle}>
          Tap to add helper pins to your board.
        </Text>
      </View>
      <View style={styles.inventoryList}>
        {availableOptions.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => onAdd(option.id)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${option.title} pin`}
            style={({ pressed }) => [
              styles.inventoryChip,
              pressed && styles.inventoryChipPressed,
            ]}
          >
            <View style={styles.inventoryChipContent}>
              <Text style={styles.inventoryChipLabel}>{option.title}</Text>
              <Text style={styles.inventoryChipSubtitle}>
                {option.subtitle}
              </Text>
            </View>
            {renderPin({
              context: "pin",
              variant: option.id,
              theme,
            })}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default PinInventory;

export const isInventoryPinActive = (
  pin: InventoryPinId,
  value: DayPinsState
) => {
  switch (pin) {
    case "difficulty":
      return Boolean(value.effort);
    case "expense":
      return Boolean(value.expense);
    case "reuse":
      return Boolean(value.reuseWeeks);
    case "family":
      return value.familyStar === "include";
    case "freezer":
      return value.freezerNight;
    default:
      return false;
  }
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    inventoryCard: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      gap: theme.space.md,
    },
    inventoryHeader: {
      gap: theme.space.xs / 2,
    },
    inventoryTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    inventorySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    inventoryList: {
      gap: theme.space.sm,
    },
    inventoryChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      gap: theme.space.sm,
    },
    inventoryChipPressed: {
      opacity: 0.85,
    },
    inventoryChipContent: {
      flex: 1,
      gap: theme.space.xs / 2,
    },
    inventoryChipLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    inventoryChipSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    inventoryEmptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
  });

import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  DayPinsState,
  EffortOption,
  ExpenseOption,
  ReuseOption,
  effortLabelMap,
  expenseLabelMap,
  normalizeDayPinsState,
  reuseLabelMap,
} from "../../types/dayPins";

type Props = {
  value: DayPinsState;
  onChange: (next: DayPinsState) => void;
  mode?: "compact" | "editable";
};

const effortOrder: Array<EffortOption | null> = [
  "easy",
  "easy_medium",
  "easy_medium_hard",
  null,
];

const expenseOrder: Array<ExpenseOption | null> = ["$", "$$", "$$$", null];
const reuseOrder: Array<ReuseOption | null> = [1, 2, 3, 4, null];
const difficultyLevels = ["easy", "medium", "hard"] as const;
const expenseLevels = [1, 2, 3] as const;

export default function DayPinsControls({
  value,
  onChange,
  mode = "editable",
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pins = useMemo(() => normalizeDayPinsState(value), [value]);
  const editable = mode === "editable";

  const update = (patch: Partial<DayPinsState>) => {
    Haptics.selectionAsync().catch(() => {});
    onChange({
      ...pins,
      ...patch,
    });
  };

  const cycleEffort = () => {
    const currentIndex = effortOrder.indexOf(pins.effort ?? null);
    update({ effort: effortOrder[(currentIndex + 1) % effortOrder.length] });
  };

  const cycleExpense = () => {
    const currentIndex = expenseOrder.indexOf(pins.expense ?? null);
    update({
      expense: expenseOrder[(currentIndex + 1) % expenseOrder.length],
    });
  };

  const cycleReuse = () => {
    const currentIndex = reuseOrder.indexOf(pins.reuseWeeks ?? null);
    update({
      reuseWeeks: reuseOrder[(currentIndex + 1) % reuseOrder.length],
    });
  };

  return (
    <View style={styles.wrap}>
      <PinChip
        title="Difficulty"
        accessibilityLabel={`Difficulty ${
          pins.effort ? effortLabelMap[pins.effort] : "Off"
        }`}
        onPress={cycleEffort}
        editable={editable}
        styles={styles}
      >
        <View style={styles.difficultyDots}>
          {difficultyLevels.map((level) => (
            <View
              key={level}
              style={[
                styles.dot,
                {
                  backgroundColor: getDifficultyColor(level, theme),
                  opacity: getEffortLevels(pins.effort).includes(level)
                    ? 1
                    : 0.25,
                },
              ]}
            />
          ))}
        </View>
      </PinChip>
      <PinChip
        title="Expense"
        accessibilityLabel={`Expense ${
          pins.expense ? expenseLabelMap[pins.expense] : "Off"
        }`}
        onPress={cycleExpense}
        editable={editable}
        styles={styles}
      >
        <View style={styles.expenseDollars}>
          {expenseLevels.map((level) => (
            <Text
              key={level}
              style={[
                styles.expenseDollarText,
                {
                  opacity: getExpenseLevelCount(pins.expense) >= level ? 1 : 0.25,
                },
              ]}
            >
              $
            </Text>
          ))}
        </View>
      </PinChip>
      <PinChip
        title="Reuse"
        accessibilityLabel={`Reuse ${
          pins.reuseWeeks ? reuseLabelMap[pins.reuseWeeks] : "Off"
        }`}
        onPress={cycleReuse}
        editable={editable}
        styles={styles}
      >
        <Text
          style={[
            styles.valueText,
            styles.reuseValueText,
            !pins.reuseWeeks && styles.offText,
          ]}
        >
          {pins.reuseWeeks ? reuseLabelMap[pins.reuseWeeks] : "Off"}
        </Text>
      </PinChip>
    </View>
  );
}

type PinChipProps = {
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
  editable: boolean;
  styles: ReturnType<typeof createStyles>;
  children: ReactNode;
};

const PinChip = ({
  title,
  accessibilityLabel,
  onPress,
  editable,
  styles,
  children,
}: PinChipProps) => (
  <Pressable
    onPress={editable ? onPress : undefined}
    disabled={!editable}
    accessibilityRole={editable ? "button" : "text"}
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [
      styles.chip,
      pressed && editable && styles.chipPressed,
    ]}
  >
    <Text style={styles.titleText} numberOfLines={1}>
      {title}
    </Text>
    {children}
  </Pressable>
);

const getEffortLevels = (effort: EffortOption | null) => {
  if (effort === "easy") {
    return ["easy"];
  }
  if (effort === "easy_medium") {
    return ["easy", "medium"];
  }
  if (effort === "easy_medium_hard") {
    return ["easy", "medium", "hard"];
  }
  return [];
};

const getDifficultyColor = (
  level: (typeof difficultyLevels)[number],
  theme: WeeklyTheme
) => {
  if (level === "easy") return theme.color.success;
  if (level === "medium") return theme.color.warning;
  return theme.color.danger;
};

const getExpenseLevelCount = (expense: ExpenseOption | null) => {
  if (expense === "$") return 1;
  if (expense === "$$") return 2;
  if (expense === "$$$") return 3;
  return 0;
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      gap: Math.max(theme.space.xs - 2, 0),
      width: "100%",
    },
    chip: {
      minHeight: 34,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: theme.space.xs,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
    },
    chipPressed: {
      opacity: 0.85,
    },
    titleText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      flexShrink: 1,
    },
    difficultyDots: {
      flexDirection: "row",
      alignItems: "center",
      gap: Math.max(theme.space.xs - 1, 0),
      flexShrink: 0,
    },
    expenseDollars: {
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
      flexShrink: 0,
    },
    expenseDollarText: {
      color: theme.color.success,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
    },
    valueText: {
      color: theme.color.success,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      flexShrink: 0,
    },
    reuseValueText: {
      color: theme.color.link,
    },
    offText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
    },
  });

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ReactNode,
  RefObject,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import {
  DayPinsState,
  EffortOption,
  ExpenseOption,
  MoodOption,
  MEAL_TYPE_OPTIONS,
  MealTypeOption,
  PinInclusion,
  ReuseOption,
  cycleArrayInclusion,
  cycleInclusion,
  createEmptyDayPinsState,
  effortLabelMap,
  expenseLabelMap,
  hasAnyPins,
  normalizeDayPinsState,
  reuseLabelMap,
} from "../../types/dayPins";
import { MealBadge } from "../meals/MealBadge";
import { renderPin, PinIndicatorVariant } from "../pins/renderPin";

type InventoryPinId = PinIndicatorVariant;

type DifficultyIndicatorLevel = "easy" | "medium" | "hard";

type MoodBadgeDescriptor =
  | { id: string; kind: "difficulty"; levels: DifficultyIndicatorLevel[] }
  | { id: string; kind: "freezer" }
  | { id: string; kind: "family" };

const PIN_INVENTORY_OPTIONS: Array<{
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

const moodBadgeMap: Record<MoodOption, MoodBadgeDescriptor[]> = {
  low_effort: [
    {
      id: "difficulty-low-effort",
      kind: "difficulty",
      levels: ["easy", "medium"],
    },
    { id: "freezer-low-effort", kind: "freezer" },
  ],
  motivated: [
    {
      id: "difficulty-motivated",
      kind: "difficulty",
      levels: ["medium", "hard"],
    },
  ],
  family_favorite: [{ id: "family-favorite", kind: "family" }],
};

type Props = {
  value: DayPinsState;
  onChange: (next: DayPinsState) => void;
  onReset?: () => void;
  dayKey?: string;
  title?: string;
  titleRef?: RefObject<Text | null>;
};

type BoardChipDescriptor = {
  id: string;
  label: string;
  mode: "include" | "exclude" | "value";
  icon?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  content?: React.ReactNode;
  presentation?: "chip" | "plain";
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PinBoard = ({
  value,
  onChange,
  onReset,
  dayKey,
  title = "Day Pins",
  titleRef,
}: Props) => {
  const normalizedValue = useMemo(() => normalizeDayPinsState(value), [value]);
  const hasPins = hasAnyPins(normalizedValue);
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pulsingChipId, setPulsingChipId] = useState<string | null>(null);

  useEffect(() => {
    if (!pulsingChipId) {
      return;
    }
    const timer = setTimeout(() => {
      setPulsingChipId(null);
    }, 320);
    return () => clearTimeout(timer);
  }, [pulsingChipId]);

  const triggerChipPulse = useCallback((id: string) => {
    setPulsingChipId(id);
  }, []);

  const updateState = useCallback(
    (patch: Partial<DayPinsState>) => {
      onChange({
        ...normalizedValue,
        ...patch,
      });
    },
    [normalizedValue, onChange]
  );

  const handleResetPins = useCallback(() => {
    const cleared = createEmptyDayPinsState();
    setPulsingChipId(null);
    onChange(cleared);
    onReset?.();
    Haptics.selectionAsync().catch(() => {});
  }, [onChange, onReset]);

  const handleFamilyStarChipPress = useCallback(() => {
    const next = normalizedValue.familyStar === "include" ? null : "include";
    Haptics.selectionAsync().catch(() => {});
    updateState({ familyStar: next });
    triggerChipPulse("family-star");
  }, [normalizedValue.familyStar, triggerChipPulse, updateState]);

  const handleEffortChipPress = useCallback(() => {
    const order: Array<EffortOption | null> = [
      "easy",
      "medium",
      "hard",
      "easy_medium",
      "medium_hard",
      null,
    ];
    const currentIndex = order.indexOf(normalizedValue.effort ?? null);
    const next = order[(currentIndex + 1) % order.length];
    Haptics.selectionAsync().catch(() => {});
    updateState({ effort: next });
    triggerChipPulse("effort");
  }, [normalizedValue.effort, triggerChipPulse, updateState]);

  const handleExpenseCycle = useCallback(() => {
    const order: Array<ExpenseOption | null> = ["$", "$$", "$$$", null];
    const currentIndex = order.indexOf(normalizedValue.expense ?? null);
    const next = order[(currentIndex + 1) % order.length];
    Haptics.selectionAsync().catch(() => {});
    updateState({ expense: next });
    triggerChipPulse("expense");
  }, [normalizedValue.expense, triggerChipPulse, updateState]);

  const handleReuseCycle = useCallback(() => {
    const order: Array<ReuseOption | null> = [1, 2, 3, 4, null];
    const currentIndex = order.indexOf(normalizedValue.reuseWeeks ?? null);
    const next = order[(currentIndex + 1) % order.length];
    Haptics.selectionAsync().catch(() => {});
    updateState({ reuseWeeks: next });
    triggerChipPulse("reuse");
  }, [normalizedValue.reuseWeeks, triggerChipPulse, updateState]);

  const handleFreezerToggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    updateState({ freezerNight: !normalizedValue.freezerNight });
    triggerChipPulse("freezer");
  }, [normalizedValue.freezerNight, triggerChipPulse, updateState]);

  const handleTypeChipPress = useCallback(
    (typeId: MealTypeOption) => {
      const hadAny =
        normalizedValue.types.length > 0 ||
        normalizedValue.excludedTypes.length > 0;
      const next = cycleArrayInclusion(
        normalizedValue.types,
        normalizedValue.excludedTypes,
        typeId
      );
      Haptics.selectionAsync().catch(() => {});
      updateState({
        types: next.include,
        excludedTypes: next.exclude,
        completed: false,
      });
      const nowHasAny = next.include.length > 0 || next.exclude.length > 0;
      const chipId = next.include.includes(typeId)
        ? `type-${typeId}`
        : next.exclude.includes(typeId)
        ? `type-${typeId}-exclude`
        : `type-${typeId}`;
      triggerChipPulse(chipId);
    },
    [
      normalizedValue.excludedTypes,
      normalizedValue.types,
      triggerChipPulse,
      updateState,
    ]
  );

  const renderBoardIndicator = useCallback(
    (
      label: string | undefined,
      variant: PinIndicatorVariant,
      levels?: DifficultyIndicatorLevel[],
      value?: string
    ) => (
      <View style={styles.boardIndicatorContent}>
        {label ? <Text style={styles.boardIndicatorLabel}>{label}</Text> : null}
        {renderPin({
          context: "pin",
          variant,
          levels,
          value,
          theme,
        })}
      </View>
    ),
    [styles.boardIndicatorContent, styles.boardIndicatorLabel, theme]
  );

  const boardChips = useMemo<BoardChipDescriptor[]>(() => {
    const chips: BoardChipDescriptor[] = [];
    const shouldShowFamilyStarChip =
      normalizedValue.familyStar === "include" &&
      normalizedValue.mood !== "family_favorite";

    if (shouldShowFamilyStarChip) {
      const mode: PinInclusion = "include";
      chips.push({
        id: "family-star",
        label: "FAMILY STAR",
        mode,
        onPress: handleFamilyStarChipPress,
        accessibilityLabel: "Family Star pin active. Double tap to remove.",
        content: (
          <View pointerEvents="none">
            <MealBadge variant="family" style={styles.boardFamilyBadge} />
          </View>
        ),
        presentation: "plain",
      });
    }

    if (normalizedValue.effort && !normalizedValue.mood) {
      const effortLevelsMap: Record<EffortOption, DifficultyIndicatorLevel[]> =
        {
          easy: ["easy"],
          medium: ["medium"],
          hard: ["hard"],
          easy_medium: ["easy", "medium"],
          medium_hard: ["medium", "hard"],
        };
      chips.push({
        id: "effort",
        label: `EFFORT: ${effortLabelMap[
          normalizedValue.effort
        ].toUpperCase()}`,
        mode: "value",
        onPress: handleEffortChipPress,
        accessibilityLabel: `Effort filter ${
          effortLabelMap[normalizedValue.effort]
        }`,
        content: renderBoardIndicator(
          "Difficulty",
          "difficulty",
          effortLevelsMap[normalizedValue.effort]
        ),
      });
    }

    normalizedValue.types.forEach((typeId) => {
      const meta = MEAL_TYPE_OPTIONS.find((item) => item.id === typeId);
      chips.push({
        id: `type-${typeId}`,
        label: `${meta?.label?.toUpperCase() ?? typeId.toUpperCase()}`,
        mode: "include",
        onPress: () => handleTypeChipPress(typeId),
        accessibilityLabel: `${meta?.label ?? typeId} included`,
      });
    });

    normalizedValue.excludedTypes.forEach((typeId) => {
      const meta = MEAL_TYPE_OPTIONS.find((item) => item.id === typeId);
      chips.push({
        id: `type-${typeId}-exclude`,
        label: `NOT ${meta?.label?.toUpperCase() ?? typeId.toUpperCase()}`,
        mode: "exclude",
        onPress: () => handleTypeChipPress(typeId),
        accessibilityLabel: `${meta?.label ?? typeId} excluded`,
      });
    });

    if (normalizedValue.expense) {
      chips.push({
        id: "expense",
        label: `EXPENSE: ${expenseLabelMap[normalizedValue.expense]}`,
        mode: "value",
        onPress: handleExpenseCycle,
        accessibilityLabel: `Expense filter ${
          expenseLabelMap[normalizedValue.expense]
        }`,
        content: renderBoardIndicator(
          "Expense",
          "expense",
          undefined,
          expenseLabelMap[normalizedValue.expense]
        ),
      });
    }

    if (normalizedValue.reuseWeeks) {
      chips.push({
        id: "reuse",
        label: `REUSE: ${reuseLabelMap[normalizedValue.reuseWeeks]}`,
        mode: "value",
        onPress: handleReuseCycle,
        accessibilityLabel: `Reuse interval ${
          reuseLabelMap[normalizedValue.reuseWeeks]
        }`,
        content: renderBoardIndicator(
          "Reuse",
          "reuse",
          undefined,
          reuseLabelMap[normalizedValue.reuseWeeks]
        ),
      });
    }

    if (normalizedValue.freezerNight) {
      chips.push({
        id: "freezer",
        label: "FREEZER NIGHT",
        mode: "value",
        onPress: handleFreezerToggle,
        accessibilityLabel: "Freezer night filter enabled",
        content: renderBoardIndicator("Freezer Night", "freezer"),
      });
    }

    return chips;
  }, [
    handleExpenseCycle,
    handleFamilyStarChipPress,
    handleFreezerToggle,
    handleReuseCycle,
    handleTypeChipPress,
    handleEffortChipPress,
    renderBoardIndicator,
    normalizedValue.effort,
    normalizedValue.excludedTypes,
    normalizedValue.expense,
    normalizedValue.familyStar,
    normalizedValue.freezerNight,
    normalizedValue.mood,
    normalizedValue.moodMode,
    normalizedValue.reuseWeeks,
    normalizedValue.types,
  ]);

  const moodBadges = useMemo<MoodBadgeDescriptor[]>(() => {
    if (!normalizedValue.mood) {
      return [];
    }
    return moodBadgeMap[normalizedValue.mood] ?? [];
  }, [normalizedValue.mood]);

  const renderPinGrid = useCallback(
    (items: ReactNode[], keyPrefix: string) => (
      <FlexGrid
        gutterWidth={theme.space.sm}
        gutterHeight={theme.space.sm}
        hasGutterWidthAtBorders={false}
        hasGutterHeightAtBorders={false}
      >
        <FlexGrid.Row wrap>
          {items.map((child, index) => {
            const resolvedKey =
              isValidElement(child) && child.key != null
                ? String(child.key)
                : `${keyPrefix}-${index}`;
            return (
              <FlexGrid.Col key={resolvedKey} grow={0} style={styles.pinColumn}>
                {child}
              </FlexGrid.Col>
            );
          })}
        </FlexGrid.Row>
      </FlexGrid>
    ),
    [styles.pinColumn, theme.space.sm]
  );

  const isInventoryOptionActive = useCallback(
    (pin: InventoryPinId) => {
      switch (pin) {
        case "difficulty":
          return Boolean(normalizedValue.effort);
        case "expense":
          return Boolean(normalizedValue.expense);
        case "reuse":
          return Boolean(normalizedValue.reuseWeeks);
        case "family":
          return normalizedValue.familyStar === "include";
        case "freezer":
          return normalizedValue.freezerNight;
        default:
          return false;
      }
    },
    [
      normalizedValue.effort,
      normalizedValue.expense,
      normalizedValue.familyStar,
      normalizedValue.freezerNight,
      normalizedValue.reuseWeeks,
    ]
  );

  const handleAddInventoryPin = useCallback(
    (pin: InventoryPinId) => {
      if (isInventoryOptionActive(pin)) {
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      switch (pin) {
        case "difficulty": {
          updateState({ effort: "easy", completed: false });
          triggerChipPulse("effort");
          break;
        }
        case "expense": {
          updateState({ expense: "$", completed: false });
          triggerChipPulse("expense");
          break;
        }
        case "reuse": {
          updateState({ reuseWeeks: 1, completed: false });
          triggerChipPulse("reuse");
          break;
        }
        case "family": {
          updateState({ familyStar: "include", completed: false });
          triggerChipPulse("family-star");
          break;
        }
        case "freezer": {
          updateState({ freezerNight: true, completed: false });
          triggerChipPulse("freezer");
          break;
        }
        default:
          break;
      }
    },
    [isInventoryOptionActive, triggerChipPulse, updateState]
  );

  const renderPinInventory = () => {
    const availableOptions = PIN_INVENTORY_OPTIONS.filter(
      (option) => !isInventoryOptionActive(option.id)
    );
    if (!availableOptions.length) {
      return (
        <View style={styles.inventoryEmpty}>
          <Text style={styles.inventoryEmptyText}>
            All helper pins are active. Edit them from the board above.
          </Text>
        </View>
      );
    }
    const nodes = availableOptions.map((option) => (
      <Pressable
        key={option.id}
        onPress={() => handleAddInventoryPin(option.id)}
        accessibilityRole="button"
        accessibilityLabel={`Add ${option.title} pin`}
        style={({ pressed }) => [
          styles.inventoryChip,
          pressed && styles.inventoryChipPressed,
        ]}
      >
        <Text style={styles.inventoryChipLabel}>{option.title}</Text>
        {renderPin({
          context: "pin",
          variant: option.id,
          theme,
        })}
      </Pressable>
    ));
    return renderPinGrid(nodes, "inventory");
  };

  return (
    <View style={styles.wrapper}>
      <View
        accessible
        accessibilityLabel={`${title} board`}
        style={styles.boardCard}
      >
        <View style={styles.boardHeader}>
          <Text ref={titleRef} style={styles.boardTitle}>
            {title}
          </Text>
          {hasPins ? (
            <Pressable
              onPress={handleResetPins}
              accessibilityRole="button"
              accessibilityLabel="Reset pins"
              style={({ pressed }) => [
                styles.resetInline,
                pressed && styles.resetInlinePressed,
              ]}
            >
              <Text style={styles.resetInlineText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        {moodBadges.length ? (
          <View style={styles.moodBadgeRow}>
            {moodBadges.map((badge) => {
              if (badge.kind === "family") {
                return (
                  <MealBadge
                    key={badge.id}
                    variant="family"
                    style={styles.familyMoodBadge}
                  />
                );
              }
              const variant =
                badge.kind === "freezer" ? "freezer" : "difficulty";
              return (
                <View key={badge.id} style={styles.moodBadgePill}>
                  <Text style={styles.moodBadgeLabel}>
                    {badge.kind === "freezer" ? "Freezer" : "Difficulty"}
                  </Text>
                  {renderPin({
                    context: "pin",
                    variant,
                    theme,
                    levels: badge.kind === "freezer" ? undefined : badge.levels,
                  })}
                </View>
              );
            })}
          </View>
        ) : null}
        {hasPins ? (
          renderPinGrid(
            boardChips.map((chip) => (
              <BoardChip
                key={chip.id}
                descriptor={chip}
                styles={styles}
                theme={theme}
                isPulsing={pulsingChipId === chip.id}
              />
            )),
            "board"
          )
        ) : (
          <Text style={styles.emptyBoardText}>
            Pins you earn will live here for quick editing.
          </Text>
        )}
      </View>

      <View style={styles.inventoryCard}>
        <View style={styles.inventoryHeader}>
          <Text style={styles.inventoryTitle}>Pin Inventory</Text>
          <Text style={styles.inventorySubtitle}>
            Tap to add helper pins to your board.
          </Text>
        </View>
        {renderPinInventory()}
      </View>
    </View>
  );
};

const BoardChip = ({
  descriptor,
  styles,
  theme,
  isPulsing,
}: {
  descriptor: BoardChipDescriptor;
  styles: ReturnType<typeof createStyles>;
  theme: WeeklyTheme;
  isPulsing: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const activePulse = useRef(false);

  const animatePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  useEffect(() => {
    if (!isPulsing || activePulse.current) {
      return;
    }
    activePulse.current = true;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      activePulse.current = false;
    });
  }, [isPulsing, scale]);

  const handlePress = useCallback(() => {
    animatePress();
    descriptor.onPress?.();
  }, [animatePress, descriptor]);

  const isPlain = descriptor.presentation === "plain";

  const chipStateStyle =
    descriptor.mode === "include"
      ? styles.boardChipInclude
      : descriptor.mode === "exclude"
      ? styles.boardChipExclude
      : styles.boardChipValue;

  const textStateStyle =
    descriptor.mode === "include"
      ? styles.boardChipLabelActive
      : descriptor.mode === "exclude"
      ? styles.boardChipLabelDanger
      : styles.boardChipLabelActive;

  return (
    <AnimatedPressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={descriptor.accessibilityLabel}
      style={[
        isPlain ? styles.boardChipPlain : styles.boardChip,
        !isPlain && chipStateStyle,
        {
          transform: [{ scale }],
        },
      ]}
    >
      {descriptor.content ? (
        descriptor.content
      ) : (
        <>
          {descriptor.icon ? (
            <MaterialCommunityIcons
              name={descriptor.icon as any}
              size={14}
              color={
                descriptor.mode === "exclude"
                  ? theme.color.danger
                  : theme.color.ink
              }
            />
          ) : null}
          <Text style={[styles.boardChipLabel, textStateStyle]}>
            {descriptor.label}
          </Text>
          {descriptor.mode === "exclude" && (
            <MaterialCommunityIcons
              name="close"
              size={14}
              color={theme.color.danger}
            />
          )}
        </>
      )}
    </AnimatedPressable>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrapper: {
      gap: theme.space.lg,
    },
    boardCard: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      gap: theme.space.md,
    },
    boardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    moodBadgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    moodBadgePill: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
      gap: theme.space.xs,
    },
    moodBadgeLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
    },
    moodBadgeIndicators: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs / 2,
    },
    moodBadgeDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    moodBadgeEmoji: {
      fontSize: theme.type.size.base,
    },
    familyMoodBadge: {
      transform: [{ scale: 0.92 }],
    },
    boardFamilyBadge: {
      transform: [{ scale: 0.92 }],
    },
    boardTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    boardChipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    boardChip: {
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      minHeight: 32,
    },
    boardChipPlain: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: 0,
      backgroundColor: "transparent",
    },
    boardChipInclude: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    boardChipExclude: {
      backgroundColor: "transparent",
      borderColor: theme.color.danger,
    },
    boardChipValue: {
      backgroundColor: theme.color.surfaceAlt,
    },
    boardChipLabel: {
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    boardIndicatorContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    boardIndicatorLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    boardChipLabelActive: {
      color: theme.color.ink,
    },
    boardChipLabelDanger: {
      color: theme.color.danger,
    },
    emptyBoardText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    resetInline: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    resetInlinePressed: {
      opacity: 0.8,
    },
    resetInlineText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
    },
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
    inventoryChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
      gap: theme.space.sm,
      alignSelf: "flex-start",
    },
    inventoryChipPressed: {
      opacity: 0.85,
    },
    inventoryChipLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    inventoryEmpty: {
      paddingVertical: theme.space.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    inventoryEmptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    pinColumn: {
      flexGrow: 0,
      flexBasis: "auto",
      minWidth: 0,
    },
  });

export default PinBoard;

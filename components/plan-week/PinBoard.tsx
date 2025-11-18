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
import { PLANNED_WEEK_DISPLAY_NAMES } from "../../types/weekPlan";
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
import { MaterialCommunityIcons as CommunityIcons } from "@expo/vector-icons";

type DifficultyIndicatorLevel = "easy" | "medium" | "hard";

type MoodBadgeDescriptor =
  | { id: string; kind: "difficulty"; levels: DifficultyIndicatorLevel[] }
  | { id: string; kind: "freezer" }
  | { id: string; kind: "family" };

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
  dayKey?: string;
  onRequestInventory?: () => void;
  pulseChipTrigger?: { id: string; nonce: number } | null;
  isInventoryOpen?: boolean;
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
  dayKey,
  onRequestInventory,
  pulseChipTrigger,
  isInventoryOpen,
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

  useEffect(() => {
    if (!pulseChipTrigger) {
      return;
    }
    triggerChipPulse(pulseChipTrigger.id);
  }, [pulseChipTrigger, triggerChipPulse]);

  const updateState = useCallback(
    (patch: Partial<DayPinsState>) => {
      onChange({
        ...normalizedValue,
        ...patch,
      });
    },
    [normalizedValue, onChange]
  );

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
        gutterWidth={theme.space.xs}
        gutterHeight={theme.space.xs}
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

  return (
    <View style={styles.wrapper}>
      <View style={styles.boardCard}>
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
        <View style={styles.boardHeaderRow}>
          <View>
            <Text style={styles.boardTitle}>
              {dayKey ? `${PLANNED_WEEK_DISPLAY_NAMES[dayKey]} Pins` : "Day Pins"}
            </Text>
            <Text style={styles.boardSubtitle}>
              Pins tailor your meal suggestions.
            </Text>
          </View>
          {onRequestInventory ? (
            <Pressable
              onPress={onRequestInventory}
              accessibilityRole="button"
              accessibilityLabel={
                isInventoryOpen ? "Close pin inventory" : "Open pin inventory"
              }
              style={({ pressed }) => [
                styles.inventoryIconButton,
                pressed && styles.inventoryIconButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                name={isInventoryOpen ? "chevron-up" : "warehouse"}
                size={18}
                color={theme.color.ink}
              />
            </Pressable>
          ) : null}
        </View>
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
      gap: theme.space.sm,
    },
    boardCard: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      gap: theme.space.xs,
    },
    boardHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    moodBadgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.xs,
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
    boardChipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.xs,
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
    inventoryIconButton: {
      padding: theme.space.sm,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      alignSelf: "flex-start",
    },
    inventoryIconButtonPressed: {
      opacity: 0.85,
    },
    boardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.space.sm,
    },
    boardTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    boardSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    pinColumn: {
      flexGrow: 0,
      flexBasis: "auto",
      minWidth: 0,
    },
  });

export default PinBoard;

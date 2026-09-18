import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { startOfDay } from "../../utils/weekDays";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import MealEmoji from "../emoji/MealEmoji";
import { hasFullFreezerMeal } from "../../utils/freezerMealAmount";
import BurstSparkles from "./BurstSparkles";

type Props = {
  days: WeekPlanDay[];
  servedEntries: ServedMealEntry[];
  onDayPress: (day: WeekPlanDay) => void;
  title?: string;
  collapsible?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  dateRange?: string;
  preview?: boolean;
  onReorder?: (days: WeekPlanDay[]) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  completionEnabled?: boolean;
  completionReady?: boolean;
  onCompletionChange?: (isComplete: boolean) => void;
  hideHeader?: boolean;
};

const entryForDay = (day: WeekPlanDay, entries: ServedMealEntry[]) => {
  const plannedTime = startOfDay(day.plannedDate).getTime();
  return entries.find(
    (entry) =>
      entry.dayKey === day.key &&
      startOfDay(new Date(entry.servedAtISO)).getTime() === plannedTime,
  );
};

const isDayResolved = (day: WeekPlanDay, entries: ServedMealEntry[]) => {
  if (!day.meal) return true;
  if (day.status === "past" && day.mealId === EAT_OUT_MEAL_ID) return true;
  return Boolean(entryForDay(day, entries));
};

export const countServedDays = (days: WeekPlanDay[], entries: ServedMealEntry[]) =>
  days.filter((day) => {
    if (day.status === "past" && day.mealId === EAT_OUT_MEAL_ID) return true;
    const outcome = entryForDay(day, entries)?.outcome;
    return Boolean(outcome && outcome !== "skipped");
  }).length;

export default function ThisWeekList({
  days,
  servedEntries,
  onDayPress,
  title = "This Week",
  collapsible = false,
  onCollapsedChange,
  dateRange,
  preview = false,
  onReorder,
  onDragStateChange,
  completionEnabled = false,
  completionReady = true,
  onCompletionChange,
  hideHeader = false,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isCollapsed, setCollapsed] = useState(false);
  const visibleDays = useMemo(
    () => (preview ? days : days.filter((day) => Boolean(day.meal))),
    [days, preview],
  );
  const [isReordering, setReordering] = useState(false);
  const isFocused = useIsFocused();
  const dragStateChangeRef = useRef(onDragStateChange);
  dragStateChangeRef.current = onDragStateChange;
  const [orderedVisibleDays, setOrderedVisibleDays] = useState(visibleDays);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const orderedDaysRef = useRef(orderedVisibleDays);
  const draggingIndexRef = useRef<number | null>(null);
  const dragOriginIndexRef = useRef<number | null>(null);
  const rowHeightRef = useRef(0);
  const layouts = useRef(new Map<string, { y: number; height: number }>()).current;
  const pan = useRef(new Animated.Value(0)).current;
  const dragTop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setReordering(false);
    setDraggingIndex(null);
    draggingIndexRef.current = null;
    dragOriginIndexRef.current = null;
    pan.stopAnimation();
    pan.setValue(0);
    dragTop.stopAnimation();
    dragTop.setValue(0);
    dragStateChangeRef.current?.(false);
  }, [isFocused, pan, dragTop]);
  const completionProgress = useRef(new Animated.Value(0)).current;
  const completionExitProgress = useRef(new Animated.Value(0)).current;
  const sparkleProgress = useRef(new Animated.Value(0)).current;
  const completionInitializedRef = useRef(false);
  const previousWeekCompleteRef = useRef(false);
  const completionAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isCompletionTransitioning, setCompletionTransitioning] = useState(false);
  const [showCompletionCheck, setShowCompletionCheck] = useState(false);
  const [completedRowsExpanded, setCompletedRowsExpanded] = useState(false);
  const [rowsHeight, setRowsHeight] = useState(0);

  const weekIsComplete = useMemo(
    () =>
      completionEnabled &&
      visibleDays.length > 0 &&
      visibleDays.every((day) => isDayResolved(day, servedEntries)),
    [completionEnabled, servedEntries, visibleDays],
  );

  useEffect(() => {
    if (completionReady) onCompletionChange?.(weekIsComplete);
  }, [completionReady, onCompletionChange, weekIsComplete]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!completionReady) return;
    if (!completionInitializedRef.current) {
      completionInitializedRef.current = true;
      previousWeekCompleteRef.current = weekIsComplete;
      setShowCompletionCheck(weekIsComplete);
      completionProgress.setValue(weekIsComplete ? 1 : 0);
      completionExitProgress.setValue(weekIsComplete ? 1 : 0);
      return;
    }

    const wasComplete = previousWeekCompleteRef.current;
    previousWeekCompleteRef.current = weekIsComplete;
    completionAnimationRef.current?.stop();

    if (!weekIsComplete) {
      setShowCompletionCheck(false);
      setCompletedRowsExpanded(false);
      setCompletionTransitioning(false);
      completionProgress.setValue(0);
      completionExitProgress.setValue(0);
      sparkleProgress.setValue(0);
      return;
    }
    if (wasComplete) return;

    setCompletionTransitioning(true);
    setShowCompletionCheck(false);
    completionProgress.setValue(0);
    completionExitProgress.setValue(0);
    sparkleProgress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(reduceMotion ? 120 : 400),
      Animated.parallel([
        Animated.timing(completionProgress, {
          toValue: 1,
          duration: reduceMotion ? 180 : 480,
          useNativeDriver: false,
        }),
        Animated.timing(sparkleProgress, {
          toValue: 1,
          duration: reduceMotion ? 1 : 430,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(reduceMotion ? 140 : 700),
      Animated.timing(completionExitProgress, {
        toValue: 1,
        duration: reduceMotion ? 160 : 320,
        useNativeDriver: false,
      }),
    ]);
    completionAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowCompletionCheck(true);
      setCompletionTransitioning(false);
    });
    return () => animation.stop();
  }, [completionExitProgress, completionProgress, completionReady, reduceMotion, sparkleProgress, weekIsComplete]);

  const isLockedForReorder = useCallback(
    (day: WeekPlanDay) =>
      !preview && entryForDay(day, servedEntries)?.outcome === "served",
    [preview, servedEntries],
  );

  useEffect(() => {
    if (!isReordering && draggingIndexRef.current === null) {
      setOrderedVisibleDays(visibleDays);
      orderedDaysRef.current = visibleDays;
    }
  }, [isReordering, visibleDays]);

  useEffect(
    () => () => onDragStateChange?.(false),
    [onDragStateChange],
  );

  const finishDrag = useCallback(() => {
    if (draggingIndexRef.current === null) return;
    const droppedDays = orderedDaysRef.current;
    setDraggingIndex(null);
    draggingIndexRef.current = null;
    dragOriginIndexRef.current = null;
    // Let the placeholder and floating row resolve into one stable frame before
    // the parent updates the persisted plan and re-enables its ScrollView.
    requestAnimationFrame(() => {
      onDragStateChange?.(false);
      onReorder?.(droppedDays);
    });
  }, [onDragStateChange, onReorder]);

  const moveMeal = useCallback((targetIndex: number) => {
    const currentIndex = draggingIndexRef.current;
    if (currentIndex === null || currentIndex === targetIndex) return;
    const direction = targetIndex > currentIndex ? 1 : -1;
    let editableTarget = targetIndex;
    while (
      editableTarget >= 0 &&
      editableTarget < orderedDaysRef.current.length &&
      isLockedForReorder(orderedDaysRef.current[editableTarget])
    ) {
      editableTarget += direction;
    }
    if (
      editableTarget < 0 ||
      editableTarget >= orderedDaysRef.current.length ||
      editableTarget === currentIndex
    ) return;

    const next = orderedDaysRef.current.map((day) => ({ ...day }));
    const currentMeal = {
      mealId: next[currentIndex].mealId,
      meal: next[currentIndex].meal,
      sides: next[currentIndex].sides,
    };
    next[currentIndex] = {
      ...next[currentIndex],
      mealId: next[editableTarget].mealId,
      meal: next[editableTarget].meal,
      sides: next[editableTarget].sides,
    };
    next[editableTarget] = { ...next[editableTarget], ...currentMeal };
    orderedDaysRef.current = next;
    setOrderedVisibleDays(next);
    draggingIndexRef.current = editableTarget;
    setDraggingIndex(editableTarget);
  }, [isLockedForReorder]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => draggingIndexRef.current !== null,
    onMoveShouldSetPanResponder: () => draggingIndexRef.current !== null,
    onPanResponderMove: (_, gesture) => {
      const origin = dragOriginIndexRef.current;
      if (origin === null || !rowHeightRef.current) return;
      const lastIndex = orderedDaysRef.current.length - 1;
      const minimumIndex = 0;
      const minimumDy = (minimumIndex - origin) * rowHeightRef.current;
      const maximumDy = (lastIndex - origin) * rowHeightRef.current;
      const dy = Math.max(minimumDy, Math.min(maximumDy, gesture.dy));
      pan.setValue(dy);
      moveMeal(Math.max(minimumIndex, Math.min(lastIndex, origin + Math.round(dy / rowHeightRef.current))));
    },
    onPanResponderRelease: finishDrag,
    onPanResponderTerminate: finishDrag,
    onPanResponderTerminationRequest: () => false,
  }), [finishDrag, moveMeal, pan]);

  const toggleReordering = useCallback(() => {
    if (!onReorder) return;
    if (isReordering) {
      finishDrag();
      onReorder(orderedDaysRef.current);
      setReordering(false);
      onDragStateChange?.(false);
      return;
    }
    const next = visibleDays.map((day) => ({ ...day }));
    orderedDaysRef.current = next;
    setOrderedVisibleDays(next);
    if (isCollapsed) {
      setCollapsed(false);
      onCollapsedChange?.(false);
    }
    setReordering(true);
  }, [finishDrag, isCollapsed, isReordering, onCollapsedChange, onDragStateChange, onReorder, visibleDays]);

  const startDrag = useCallback((day: WeekPlanDay, index: number) => {
    if (!isReordering || isLockedForReorder(day)) return;
    const layout = layouts.get(day.key);
    if (!layout) return;
    rowHeightRef.current = layout.height;
    dragTop.setValue(layout.y);
    pan.setValue(0);
    draggingIndexRef.current = index;
    dragOriginIndexRef.current = index;
    setDraggingIndex(index);
    onDragStateChange?.(true);
  }, [dragTop, isLockedForReorder, isReordering, layouts, onDragStateChange, pan]);

  const handleLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    layouts.set(key, event.nativeEvent.layout);
  }, [layouts]);

  const renderDay = (day: WeekPlanDay, index: number, overlay = false) => {
          const entry = preview ? undefined : entryForDay(day, servedEntries);
          const isServed = entry?.outcome === "served";
          const isEatOut = day.mealId === EAT_OUT_MEAL_ID;
          const isPastEatOut = !preview && isEatOut && day.status === "past";
          const isCompleted = isPastEatOut || Boolean(entry && entry.outcome !== "skipped");
          const isSkipped = entry?.outcome === "skipped";
          const isPending = !preview && day.status === "past" && Boolean(day.meal) && !entry && !isPastEatOut;
          const isToday = !preview && day.status === "today";
          const isFreezerMeal = hasFullFreezerMeal(day.meal);
          const canDrag = isReordering && !isLockedForReorder(day);
          const eatOutNote = isEatOut && day.meal?.title !== EAT_OUT_MEAL.title
            ? day.meal?.title.trim()
            : day.meal?.prepNotes?.trim();
          return (
            <Pressable
              key={overlay ? undefined : day.key}
              onLayout={overlay ? undefined : (event) => handleLayout(day.key, event)}
              onPress={isReordering ? undefined : () => onDayPress(day)}
              onPressIn={canDrag ? () => startDrag(day, index) : undefined}
              {...(canDrag && draggingIndex === index ? panResponder.panHandlers : {})}
              accessibilityRole="button"
              accessibilityLabel={canDrag ? `Drag ${day.meal?.title ?? "meal"} from ${day.displayName}` : `${day.displayName}, ${isEatOut ? "Eat Out" : day.meal?.title ?? "unplanned"}${eatOutNote ? `, ${eatOutNote}` : ""}${isServed ? ", served" : ""}`}
              style={({ pressed }) => [
                styles.row,
                isToday && styles.todayRow,
                isCompleted && styles.servedRow,
                isCompletionTransitioning && styles.completingRow,
                !overlay && draggingIndex === index && styles.draggingPlaceholder,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.day, isToday && !isServed && styles.todayText]}>{day.label}</Text>
              <View style={styles.statusIcon}>
                {isEatOut ? <MaterialCommunityIcons name="silverware-fork-knife" size={19} color={theme.color.accent} />
                : isCompleted ? <MaterialCommunityIcons name="check" size={18} color={isServed ? theme.color.success : theme.color.accent} />
                : isSkipped ? <MaterialCommunityIcons name="minus" size={18} color={theme.color.subtleInk} />
                : isPending ? <MaterialCommunityIcons name="clock-outline" size={17} color={theme.color.warning} />
                : <MealEmoji value={day.meal?.emoji} size={22} fallback="·" />}
              </View>
              <View style={styles.mealCopy}>
                <View style={styles.titleRow}><Text style={[styles.title, isCompleted && styles.servedText]} numberOfLines={1}>{isEatOut ? "Eat Out" : day.meal?.title ?? "Unplanned"}</Text></View>
                {isEatOut && eatOutNote ? <Text style={styles.sides} numberOfLines={1}>{eatOutNote}</Text>
                : !isEatOut && day.sides.length ? <Text style={styles.sides} numberOfLines={1}>{day.sides.join(" · ")}</Text> : null}
              </View>
              {!isReordering ? <View style={styles.statusColumn}>
                {isServed ? <Text style={styles.servedLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Served</Text>
                : isToday ? <Text style={styles.tonight} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Tonight</Text>
                : isPending ? <Text style={styles.pending} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Pending</Text>
                : isFreezerMeal ? <MaterialCommunityIcons name="snowflake" size={18} color={theme.color.accent} accessibilityLabel="Freezer meal" /> : null}
              </View> : null}
              <MaterialCommunityIcons name={canDrag ? "drag-vertical" : isReordering ? "lock-outline" : "chevron-right"} size={21} color={theme.color.subtleInk} />
            </Pressable>
          );
  };

  const draggedDay = draggingIndex === null ? undefined : orderedVisibleDays[draggingIndex];
  const rowsMotionStyle = {
    opacity: completionProgress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 0.12, 0] }),
    transform: reduceMotion ? [] : [
      { translateY: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
      { scaleY: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
    ],
  };
  const completeMotionStyle = {
    opacity: Animated.multiply(
      completionProgress,
      completionExitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    ),
    transform: reduceMotion ? [] : [
      { translateY: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
      { scale: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
      { scale: completionExitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
    ],
  };
  const completionStageHeight = rowsHeight > 0
    ? completionProgress.interpolate({ inputRange: [0, 1], outputRange: [rowsHeight, 118] })
    : undefined;
  const completionStageMotionStyle = completionStageHeight ? {
    height: Animated.multiply(
      completionStageHeight,
      completionExitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    ),
  } : undefined;
  return (
    <View style={styles.section}>
      {!hideHeader ? <View style={styles.header}>
        <Pressable
          disabled={!collapsible || (isReordering && !showCompletionCheck)}
          onPress={() => {
            if (isCollapsed) {
              setCollapsed(false);
              onCollapsedChange?.(false);
              return;
            }
            if (showCompletionCheck) {
              setCompletedRowsExpanded((current) => !current);
              return;
            }
            setCollapsed(true);
            onCollapsedChange?.(true);
          }}
          accessibilityRole={collapsible ? "button" : undefined}
          accessibilityLabel={collapsible
            ? isCollapsed
              ? `Expand ${title}`
              : showCompletionCheck
                ? `${completedRowsExpanded ? "Collapse" : "Show"} completed ${title}`
                : `Collapse ${title}`
            : undefined}
          style={({ pressed }) => [styles.headingCopy, collapsible && pressed && styles.pressed]}
        >
          <View style={styles.headingRow}>
            <Text style={styles.heading}>{title}</Text>
            {showCompletionCheck ? <MaterialCommunityIcons name="check-circle" size={22} color={theme.color.accent} accessibilityLabel={`${title} complete`} /> : null}
          </View>
          {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}
        </Pressable>
        <View style={styles.headerMeta}>
          {isCollapsed && collapsible ? <Pressable
            style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
            onPress={() => {
              setCollapsed(false);
              onCollapsedChange?.(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Expand ${title}`}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={theme.color.subtleInk}
            />
          </Pressable> : onReorder && !weekIsComplete ? <Pressable
            style={({ pressed }) => [styles.swapButton, isReordering && styles.swapButtonActive, pressed && styles.pressed]}
            onPress={toggleReordering}
            accessibilityRole="button"
            accessibilityLabel={isReordering ? `Finish rearranging ${title}` : `Rearrange ${title}`}
          >
            <MaterialCommunityIcons name={isReordering ? "check" : "swap-vertical"} size={20} color={isReordering ? theme.color.surface : theme.color.subtleInk} />
          </Pressable> : null}
          {showCompletionCheck && !isCollapsed ? (
            <Pressable
              style={({ pressed }) => [styles.completionToggle, pressed && styles.pressed]}
              onPress={() => setCompletedRowsExpanded((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={`${completedRowsExpanded ? "Collapse" : "Show"} completed ${title}`}
            >
              <MaterialCommunityIcons name={completedRowsExpanded ? "chevron-up" : "chevron-down"} size={22} color={theme.color.subtleInk} />
            </Pressable>
          ) : null}
        </View>
      </View> : null}
      {!isCollapsed && showCompletionCheck && completedRowsExpanded ? (
        <View style={styles.list}>
          {orderedVisibleDays.map((day, index) => renderDay(day, index))}
        </View>
      ) : !isCollapsed && !showCompletionCheck ? (
          <Animated.View style={[styles.completionStage, completionStageMotionStyle]}>
            <Animated.View
              onLayout={(event) => {
                if (!isCompletionTransitioning && !weekIsComplete) {
                  setRowsHeight(event.nativeEvent.layout.height);
                }
              }}
              style={[styles.list, rowsMotionStyle]}
              {...(draggingIndex !== null ? panResponder.panHandlers : {})}
            >
              {orderedVisibleDays.map((day, index) => renderDay(day, index))}
              {draggedDay ? <Animated.View pointerEvents="none" style={[styles.dragOverlay, { transform: [{ translateY: Animated.add(dragTop, pan) }] }]}>{renderDay(draggedDay, draggingIndex ?? 0, true)}</Animated.View> : null}
            </Animated.View>
            {isCompletionTransitioning || (completionReady && weekIsComplete && !showCompletionCheck) ? (
              <Animated.View pointerEvents="none" style={[styles.weekCompleteOverlay, completeMotionStyle]}>
                {!reduceMotion ? <BurstSparkles progress={sparkleProgress} visible particleCount={6} distanceScale={0.62} particleSize={6} originYOffset={0} /> : null}
                <MaterialCommunityIcons name="star-four-points" size={13} color={theme.color.accent} style={styles.completeSparkleLeft} />
                <MaterialCommunityIcons name="star-four-points" size={16} color={theme.color.accent} style={styles.completeSparkleRight} />
                <MaterialCommunityIcons name="check-circle" size={43} color={theme.color.accent} />
                <Text style={styles.weekCompleteText}>Week Complete</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  section: { gap: theme.space.md },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: theme.space.md },
  headingCopy: { flex: 1, gap: 2 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  heading: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  dateRange: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  swapButton: { width: 36, height: 36, borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  swapButtonActive: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  completionToggle: { width: 36, height: 36, borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  list: { position: "relative", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  completionStage: { position: "relative", overflow: "hidden" },
  weekComplete: { position: "relative", minHeight: 118, alignItems: "center", justifyContent: "center", gap: theme.space.sm, overflow: "hidden", borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.mode === "dark" ? "rgba(255,75,145,0.42)" : "rgba(255,75,145,0.26)", backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.12)" : "#FFF2F7" },
  weekCompleteOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: theme.space.sm, overflow: "hidden", borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.mode === "dark" ? "rgba(255,75,145,0.42)" : "rgba(255,75,145,0.26)", backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.12)" : "#FFF2F7" },
  weekCompleteText: { color: theme.color.accent, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  completeSparkleLeft: { position: "absolute", left: "32%", top: 28, opacity: 0.55 },
  completeSparkleRight: { position: "absolute", right: "31%", top: 20, opacity: 0.48 },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingHorizontal: theme.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  todayRow: { backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.08)" : "rgba(255,75,145,0.05)", borderLeftWidth: 2, borderLeftColor: theme.color.accent },
  servedRow: {
    backgroundColor:
      theme.mode === "dark"
        ? "rgba(0,255,156,0.08)"
        : "rgba(16,185,129,0.07)",
    borderLeftWidth: 2,
    borderLeftColor: theme.color.success,
  },
  completingRow: { backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.12)" : "#FFF2F7", borderLeftColor: theme.color.accent, borderBottomColor: theme.mode === "dark" ? "rgba(255,75,145,0.25)" : "rgba(255,75,145,0.16)" },
  statusIcon: { width: 24, alignItems: "center" },
  emoji: { fontSize: 19 },
  day: { width: 38, color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.7 },
  todayText: { color: theme.color.accent },
  mealCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  title: { flexShrink: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  servedText: { color: theme.color.subtleInk },
  statusColumn: { minWidth: 52, alignItems: "flex-end", justifyContent: "center", flexShrink: 0 },
  tonight: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium },
  servedLabel: { color: theme.color.success, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold },
  sides: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  pending: { color: theme.color.warning, fontSize: theme.type.size.xs },
  pressed: { opacity: 0.72 },
  draggingPlaceholder: { opacity: 0 },
  dragOverlay: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 10, elevation: 8, backgroundColor: theme.color.surface, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
});

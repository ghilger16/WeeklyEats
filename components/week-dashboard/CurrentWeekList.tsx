import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import WeekDayListItem from "./WeekDayListItem";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";

type Props = {
  days: WeekPlanDay[];
  title?: string;
  onReorder?: (days: WeekPlanDay[]) => void;
  onDragStateChange?: (isDragging: boolean) => void;
};

export default function CurrentWeekList({
  days: rawDays,
  title = "Current Week",
  onReorder,
  onDragStateChange,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const upcomingDays = useMemo(
    () => rawDays.filter((day) => day.status === "upcoming"),
    [rawDays]
  );

  const [isEditing, setEditing] = useState(false);
  const [sortedDays, setSortedDays] = useState<WeekPlanDay[]>(() =>
    upcomingDays.map((day) => ({ ...day }))
  );
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const pan = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const dragHeightRef = useRef(0);
  const dragOffsetValueRef = useRef(0);
  const itemLayouts = useRef(
    new Map<string, { y: number; height: number }>()
  ).current;
  const sortedDaysRef = useRef(sortedDays);
  const draggingIndexRef = useRef<number | null>(draggingIndex);
  const draggingKeyRef = useRef<string | null>(draggingKey);
  const draggingMealRef = useRef<WeekPlanDay["meal"] | undefined>(undefined);
  const draggingLabelRef = useRef<string | null>(null);
  const dragOriginIndexRef = useRef<number | null>(null);

  const syncSortedDays = useCallback((source: WeekPlanDay[]) => {
    const clone = source.map((day) => ({ ...day }));
    setSortedDays(clone);
    sortedDaysRef.current = clone;
  }, []);

  useEffect(() => {
    if (isEditing || draggingKeyRef.current) {
      return;
    }
    syncSortedDays(upcomingDays);
  }, [isEditing, syncSortedDays, upcomingDays]);

  useEffect(() => {
    sortedDaysRef.current = sortedDays;
  }, [sortedDays]);

  useEffect(() => {
    draggingIndexRef.current = draggingIndex;
  }, [draggingIndex]);

  useEffect(() => {
    draggingKeyRef.current = draggingKey;
  }, [draggingKey]);

  const toggleEditing = useCallback(() => {
    if (isEditing) {
      onReorder?.(sortedDaysRef.current);
      setDraggingKey(null);
      setDraggingIndex(null);
      draggingKeyRef.current = null;
      draggingIndexRef.current = null;
      draggingMealRef.current = undefined;
      draggingLabelRef.current = null;
      dragOriginIndexRef.current = null;
      dragOffsetValueRef.current = 0;
      pan.setValue(0);
      dragOffset.setValue(0);
      onDragStateChange?.(false);
      setEditing(false);
    } else {
      syncSortedDays(upcomingDays);
      draggingKeyRef.current = null;
      draggingIndexRef.current = null;
      draggingMealRef.current = undefined;
      draggingLabelRef.current = null;
      dragOriginIndexRef.current = null;
      dragOffsetValueRef.current = 0;
      setEditing(true);
    }
  }, [
    dragOffset,
    isEditing,
    onDragStateChange,
    onReorder,
    pan,
    syncSortedDays,
    upcomingDays,
  ]);

  const shiftMeals = useCallback((targetIndex: number) => {
    const currentIndex = draggingIndexRef.current;
    if (currentIndex == null || targetIndex === currentIndex) {
      return;
    }

    const next = sortedDaysRef.current.map((day) => ({ ...day }));
    if (targetIndex > currentIndex) {
      for (let i = currentIndex; i < targetIndex; i += 1) {
        const tempMeal = next[i].meal;
        const tempMealId = next[i].mealId;
        next[i].meal = next[i + 1].meal;
        next[i].mealId = next[i + 1].mealId;
        next[i + 1].meal = tempMeal;
        next[i + 1].mealId = tempMealId;
      }
    } else {
      for (let i = currentIndex; i > targetIndex; i -= 1) {
        const tempMeal = next[i].meal;
        const tempMealId = next[i].mealId;
        next[i].meal = next[i - 1].meal;
        next[i].mealId = next[i - 1].mealId;
        next[i - 1].meal = tempMeal;
        next[i - 1].mealId = tempMealId;
      }
    }

    draggingLabelRef.current = next[targetIndex]?.label ?? null;
    sortedDaysRef.current = next;
    setSortedDays(next);
    draggingIndexRef.current = targetIndex;
    setDraggingIndex(targetIndex);
  }, []);

  const handleDragMove = useCallback(
    (offsetY: number) => {
      const originIndex = dragOriginIndexRef.current;
      const currentIndex = draggingIndexRef.current;
      if (originIndex == null || currentIndex == null) {
        return;
      }

      const rowHeight = dragHeightRef.current;
      const baseOffset = dragOffsetValueRef.current;
      if (!rowHeight) {
        return;
      }
      const minDy = -baseOffset;
      const maxDy =
        (sortedDaysRef.current.length - 1) * rowHeight - baseOffset;
      const clampedDy = Math.max(minDy, Math.min(maxDy, offsetY));
      pan.setValue(clampedDy);

      const delta = Math.round(clampedDy / rowHeight);
      const proposed = Math.max(
        0,
        Math.min(sortedDaysRef.current.length - 1, originIndex + delta)
      );

      if (proposed !== currentIndex) {
        shiftMeals(proposed);
      }
    },
    [shiftMeals, pan]
  );

  const finishDrag = useCallback(() => {
    if (draggingKeyRef.current) {
      setDraggingKey(null);
      setDraggingIndex(null);
      draggingKeyRef.current = null;
      draggingIndexRef.current = null;
      draggingMealRef.current = undefined;
      draggingLabelRef.current = null;
      dragOriginIndexRef.current = null;
      onReorder?.(sortedDaysRef.current);
      onDragStateChange?.(false);
    }
  }, [onDragStateChange, onReorder]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          draggingKeyRef.current !== null && isEditing,
        onStartShouldSetPanResponderCapture: () =>
          draggingKeyRef.current !== null && isEditing,
        onMoveShouldSetPanResponder: () =>
          draggingKeyRef.current !== null && isEditing,
        onMoveShouldSetPanResponderCapture: () =>
          draggingKeyRef.current !== null && isEditing,
        onPanResponderMove: (_, gestureState) => {
          if (!isEditing || !draggingKeyRef.current) {
            return;
          }
          handleDragMove(gestureState.dy);
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => false,
      }),
    [finishDrag, handleDragMove, isEditing, pan]
  );

  const handleItemLayout = useCallback(
    (key: string, event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      itemLayouts.set(key, { y, height });
    },
    [itemLayouts]
  );

  const startDrag = useCallback(
    (key: string, index: number) => {
      if (!isEditing) {
        return;
      }
      const layout = itemLayouts.get(key);
      if (!layout) {
        return;
      }
      dragHeightRef.current = layout.height;
      dragOffset.setValue(layout.y);
      pan.setValue(0);
      draggingKeyRef.current = key;
      draggingIndexRef.current = index;
      dragOriginIndexRef.current = index;
      dragOffsetValueRef.current = layout.y;
      draggingMealRef.current = sortedDaysRef.current[index]?.meal;
      draggingLabelRef.current = sortedDaysRef.current[index]?.label ?? null;
      setDraggingKey(key);
      setDraggingIndex(index);
      onDragStateChange?.(true);
    },
    [dragOffset, isEditing, itemLayouts, onDragStateChange, pan]
  );

  const renderRow = useCallback(
    (day: WeekPlanDay, index: number) => {
      const isDraggingRow = draggingIndex === index;
      const handlePressIn = () => startDrag(day.key, index);

      return (
        <View
          key={day.key}
          onLayout={(event) => handleItemLayout(day.key, event)}
          style={[styles.rowContainer, isDraggingRow && styles.draggingPlaceholder]}
        >
          <WeekDayListItem
            dayLabel={day.label}
            meal={day.meal}
            isFreezer={Boolean(day.meal?.isFavorite)}
            rightSlot={
              isEditing ? (
                <Pressable
                  onPressIn={handlePressIn}
                  hitSlop={8}
                  {...(isDraggingRow ? panResponder.panHandlers : undefined)}
                  style={styles.handleButton}
                >
                  <MaterialCommunityIcons
                    name="drag-vertical"
                    size={20}
                    color={theme.color.subtleInk}
                  />
                </Pressable>
              ) : undefined
            }
          />
        </View>
      );
    },
    [
      draggingIndex,
      handleItemLayout,
      isEditing,
      panResponder,
      startDrag,
      styles.draggingPlaceholder,
      styles.handleButton,
      styles.rowContainer,
      theme.color.subtleInk,
    ]
  );

  const draggingItem =
    draggingIndex !== null ? sortedDays[draggingIndex] : undefined;
  const overlayMeal = draggingMealRef.current ?? draggingItem?.meal;
  const overlayLabel = draggingLabelRef.current ?? draggingItem?.label ?? "";

  const cardHandlers = draggingIndex !== null ? panResponder.panHandlers : undefined;

  return (
    <View style={styles.card} {...(cardHandlers ?? {})}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name="calendar-week"
              size={20}
              color={theme.color.accent}
            />
          </View>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Pressable
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={
            isEditing
              ? "Finish editing week order"
              : "Edit or reorder upcoming meals"
          }
          onPress={toggleEditing}
        >
          <MaterialCommunityIcons
            name={isEditing ? "check" : "swap-vertical"}
            size={20}
            color={theme.color.subtleInk}
          />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.listContainer}>
        <View>{sortedDays.map((day, index) => renderRow(day, index))}</View>
        {isEditing && draggingIndex !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dragOverlay,
              {
                transform: [
                  {
                    translateY: Animated.add(dragOffset, pan),
                  },
                ],
              },
            ]}
          >
            <WeekDayListItem
              dayLabel={overlayLabel}
              meal={overlayMeal}
              isFreezer={Boolean(overlayMeal?.isFavorite)}
            />
          </Animated.View>
        ) : null}
      </View>

      <Pressable style={styles.footer} accessibilityRole="button">
        <Text style={styles.footerText}>Show all</Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={theme.color.subtleInk}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
    },
    listContainer: {
      position: "relative",
    },
    rowContainer: {
      position: "relative",
    },
    draggingPlaceholder: {
      opacity: 0,
    },
    handleButton: {
      padding: theme.space.xs,
    },
    dragOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 10,
      elevation: 8,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    footerText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
  });

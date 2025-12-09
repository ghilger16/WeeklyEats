import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ComponentRef, RefObject, useMemo } from "react";
import { FlexGrid } from "../../../styles/flex-grid";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import SuggestionBanner from "./SuggestionBanner";

type DifficultyKey = "easy" | "medium" | "hard";

type SuggestionsTabProps = {
  meal?: Meal;
  ratingLabel: string;
  costLabel: string;
  mealDifficulty: DifficultyKey | null;
  lastServedLabel: string;
  bannerMessage: string | null;
  bannerOpacity: Animated.Value;
  sides: string[];
  sideInput: string;
  isSideDeleteMode: boolean;
  onChangeSideInput: (value: string) => void;
  onFocusSideInput?: () => void;
  onSubmitSide: () => void;
  onToggleSideDeleteMode: () => void;
  onRemoveSide: (index: number) => void;
  onAdd: () => void;
  onShuffle: () => void;
  mealTitleRef: RefObject<ComponentRef<typeof Text> | null>;
};

const SuggestionsTab = ({
  meal,
  ratingLabel,
  costLabel,
  mealDifficulty,
  lastServedLabel,
  bannerMessage,
  bannerOpacity,
  sides,
  sideInput,
  isSideDeleteMode,
  onChangeSideInput,
  onFocusSideInput,
  onSubmitSide,
  onToggleSideDeleteMode,
  onRemoveSide,
  onAdd,
  onShuffle,
  mealTitleRef,
}: SuggestionsTabProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasSides = sides.length > 0;
  const isFreezerMeal = useMemo(() => {
    if (!meal) {
      return false;
    }
    const amount = meal.freezerAmount?.trim();
    const quantity = meal.freezerQuantity?.trim();
    return Boolean(amount || quantity || meal.freezerAddedAt);
  }, [meal]);
  const freezerPortionLabel = useMemo(() => {
    if (!isFreezerMeal || !meal) {
      return "";
    }
    const quantity = (meal.freezerQuantity ?? "").trim();
    const amount = (meal.freezerAmount ?? "").trim();
    const unit = (meal.freezerUnit ?? "").trim();
    if (amount) {
      return `Portions left: ${amount}${unit ? ` ${unit}` : ""}`;
    }
    if (quantity) {
      return `Portions left: ${quantity}`;
    }
    return "Portions left in freezer";
  }, [isFreezerMeal, meal]);

  const freezerDateLabel = useMemo(() => {
    if (!isFreezerMeal || !meal) {
      return "";
    }
    const addedAt = meal.freezerAddedAt ?? "";
    const updatedAt = meal.updatedAt ?? "";
    const parseDate = (value: string) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? null
        : parsed.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
    };
    const addedDate = parseDate(addedAt);
    if (addedDate) {
      return `Added to freezer ${addedDate}`;
    }
    const updatedDate = parseDate(updatedAt);
    if (updatedDate) {
      return `Inventory checked ${updatedDate}`;
    }
    return "";
  }, [isFreezerMeal, meal]);

  return (
    <View style={styles.container}>
      <View style={styles.mealCard}>
        <View style={styles.mealHero}>
          {bannerMessage ? (
            <SuggestionBanner
              message={bannerMessage}
              opacity={bannerOpacity}
              variant="hero"
            />
          ) : null}
          <View style={styles.mealHeroContent}>
            <Text style={styles.mealEmoji}>{meal?.emoji ?? "🍽️"}</Text>
            <View style={styles.mealHeroDetails}>
              {isFreezerMeal ? (
                <View style={styles.freezerInfo}>
                  <View style={styles.freezerPill}>
                    <MaterialCommunityIcons
                      name="snowflake"
                      size={14}
                      color={theme.color.accent}
                    />
                    <Text style={styles.freezerPillText}>Freezer meal</Text>
                  </View>
                  <Text style={styles.freezerInfoText}>
                    {freezerPortionLabel}
                  </Text>
                  {freezerDateLabel ? (
                    <Text style={styles.freezerInfoSubtle}>
                      {freezerDateLabel}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <FlexGrid
                    gutterWidth={theme.space.md}
                    style={styles.mealHeroMetaGrid}
                  >
                    <FlexGrid.Row
                      alignItems="center"
                      justifyContent="flex-start"
                      style={styles.mealHeroMetaRow}
                    >
                      <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons
                            name="star"
                            size={16}
                            color={theme.color.accent}
                          />
                          <Text style={styles.metaText}>{ratingLabel}</Text>
                        </View>
                      </FlexGrid.Col>
                      <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaText}>{costLabel}</Text>
                        </View>
                      </FlexGrid.Col>
                      <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons
                            name="circle"
                            size={14}
                            color={
                              theme.color[
                                difficultyToThemeColor(
                                  mealDifficulty ?? "medium"
                                )
                              ]
                            }
                          />
                          <Text style={styles.metaText}>
                            {mealDifficulty
                              ? difficultyToLabel[mealDifficulty]
                              : "--"}
                          </Text>
                        </View>
                      </FlexGrid.Col>
                    </FlexGrid.Row>
                  </FlexGrid>
                  <Text style={styles.lastServed}>{lastServedLabel}</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.mealContent}>
          <Text ref={mealTitleRef} style={styles.mealTitle} numberOfLines={1}>
            {meal?.title ?? "No suggestion"}
          </Text>
          {sides.length ? (
            <View style={styles.sideList}>
              {sides.map((side, index) => (
                <Pressable
                  key={`${side}-${index}`}
                  onPress={() => {
                    if (isSideDeleteMode) {
                      onRemoveSide(index);
                    }
                  }}
                  disabled={!isSideDeleteMode}
                  accessibilityRole={isSideDeleteMode ? "button" : "text"}
                  accessibilityLabel={
                    isSideDeleteMode ? `Remove side ${side}` : `Side ${side}`
                  }
                  style={({ pressed }) => [
                    styles.sideChip,
                    isSideDeleteMode && styles.sideChipDeleteMode,
                    pressed && isSideDeleteMode && styles.sideChipPressed,
                  ]}
                >
                  <Text style={styles.sideChipText}>w/ {side}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.sideInputRow}>
            <TextInput
              value={sideInput}
              onChangeText={onChangeSideInput}
              onFocus={onFocusSideInput}
              onSubmitEditing={onSubmitSide}
              placeholder="Add a side"
              placeholderTextColor={theme.color.subtleInk}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.sideInput}
              accessibilityLabel="Add a side dish"
            />
            <Pressable
              onPress={onToggleSideDeleteMode}
              disabled={!hasSides}
              accessibilityRole="button"
              accessibilityLabel={
                isSideDeleteMode ? "Exit side delete mode" : "Delete sides"
              }
              style={({ pressed }) => [
                styles.sideTrashButton,
                pressed && hasSides && styles.sideTrashButtonPressed,
                isSideDeleteMode && styles.sideTrashButtonActive,
                !hasSides && styles.sideTrashButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                name={isSideDeleteMode ? "trash-can" : "trash-can-outline"}
                size={18}
                color={
                  !hasSides
                    ? theme.color.border
                    : isSideDeleteMode
                    ? theme.color.ink
                    : theme.color.subtleInk
                }
              />
            </Pressable>
          </View>
        </View>
      </View>
      <FlexGrid gutterWidth={theme.space.sm}>
        <FlexGrid.Row alignItems="center">
          <FlexGrid.Col span={6}>
            <PlannerActionButton
              icon="check"
              label="Add"
              onPress={onAdd}
              disabled={!meal}
              styles={styles}
            />
          </FlexGrid.Col>
          <FlexGrid.Col span={6}>
            <PlannerActionButton
              icon="shuffle"
              label="Shuffle"
              onPress={onShuffle}
              disabled={!meal}
              styles={styles}
            />
          </FlexGrid.Col>
        </FlexGrid.Row>
      </FlexGrid>
    </View>
  );
};

export default SuggestionsTab;

type PlannerActionButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
  accessibilityLabel?: string;
};

const PlannerActionButton = ({
  icon,
  label,
  onPress,
  disabled,
  styles,
  accessibilityLabel,
}: PlannerActionButtonProps) => {
  const { theme } = useThemeController();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={18}
        color={disabled ? theme.color.subtleInk : theme.color.ink}
      />
      <Text
        style={[
          styles.actionButtonText,
          disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const difficultyToThemeColor = (difficulty: DifficultyKey) => {
  switch (difficulty) {
    case "easy":
      return "success" as const;
    case "hard":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const difficultyToLabel: Record<DifficultyKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      gap: theme.space.lg,
    },
    mealCard: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      overflow: "hidden",
    },
    mealHero: {
      backgroundColor: theme.color.surfaceAlt,
    },
    mealHeroContent: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.md,
    },
    mealHeroDetails: {
      alignSelf: "stretch",
      alignItems: "flex-start",
      gap: theme.space.xs,
    },
    mealEmoji: {
      fontSize: 64,
    },
    mealHeroMetaGrid: {
      width: "100%",
    },
    mealHeroMetaRow: {
      columnGap: theme.space.sm,
    },
    gridAutoCol: {
      flexBasis: "auto",
      flexGrow: 0,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    metaText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    freezerInfo: {
      alignSelf: "stretch",
      gap: theme.space.xs,
    },
    freezerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: Math.max(4, theme.space.xs),
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    freezerPillText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
    },
    freezerInfoText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    freezerInfoSubtle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    lastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      textAlign: "center",
    },
    mealContent: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.sm,
    },
    mealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    sideList: {
      gap: theme.space.xs,
    },
    sideChip: {
      borderRadius: 0,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: Math.max(4, theme.space.xs * 1.2),
      alignSelf: "stretch",
    },
    sideChipDeleteMode: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.danger,
    },
    sideChipPressed: {
      opacity: 0.8,
    },
    sideChipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    sideInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    sideInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.subtleInk,
      backgroundColor: theme.color.bg,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    sideTrashButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    sideTrashButtonPressed: {
      opacity: 0.7,
    },
    sideTrashButtonActive: {
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
    },
    sideTrashButtonDisabled: {
      opacity: 0.5,
    },
    actionButton: {
      flex: 1,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingVertical: theme.space.sm,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    actionButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
  });

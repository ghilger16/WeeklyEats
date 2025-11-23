import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";

type Props = {
  visible: boolean;
  meals: Meal[];
  onDismiss: () => void;
  onSelectMeal: (meal: Meal) => void;
  title?: string;
  subtitle?: string;
  initialQuery?: string;
  sides?: string[];
  onAddSide?: (value: string) => void;
  onRemoveSide?: (index: number) => void;
};

export default function MealSearchModal({
  visible,
  meals,
  onDismiss,
  onSelectMeal,
  title = "Pick a meal",
  subtitle = "Search your saved meals",
  initialQuery = "",
  sides = [],
  onAddSide,
  onRemoveSide,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState(initialQuery);
  const [sideInput, setSideInput] = useState("");
  const [isSideDeleteMode, setSideDeleteMode] = useState(false);
  const [step, setStep] = useState<"search" | "sides">("search");
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setSideInput("");
      setSideDeleteMode(false);
      setStep("search");
      setSelectedMeal(null);
    }
  }, [initialQuery, visible]);

  useEffect(() => {
    if (!sides.length && isSideDeleteMode) {
      setSideDeleteMode(false);
    }
  }, [isSideDeleteMode, sides.length]);

  const filteredMeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return meals;
    }
    return meals.filter((meal) =>
      meal.title.toLowerCase().includes(normalized)
    );
  }, [meals, query]);

  const handleSelect = (meal: Meal) => {
    if (onAddSide) {
      setSelectedMeal(meal);
      setStep("sides");
      return;
    }
    onSelectMeal(meal);
    onDismiss();
  };

  const formatSideLabel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed
      .split(/\s+/)
      .map(
        (segment) =>
          segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
      )
      .join(" ");
  };

  const handleSubmitSide = () => {
    if (!onAddSide) return;
    const formatted = formatSideLabel(sideInput);
    if (!formatted) {
      setSideInput("");
      return;
    }
    onAddSide(formatted);
    setSideInput("");
  };

  const hasSidesUi = Boolean(onAddSide);
  const hasSides = sides.length > 0;
  const showSideStep = step === "sides" && hasSidesUi && selectedMeal;

  return (
    <Modal
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPad} onPress={onDismiss} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.body}>
            {showSideStep ? (
              <View style={styles.sidesStep}>
                <View style={styles.headerRow}>
                  <Pressable
                    onPress={() => {
                      setStep("search");
                      setSelectedMeal(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Choose a different meal"
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.backButtonPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={20}
                      color={theme.color.subtleInk}
                    />
                  </Pressable>
                  <Text style={styles.stepTitle}>Add a side (optional)</Text>
                  <View style={styles.headerSpacer} />
                </View>

                <View style={styles.selectedMeal}>
                  <Text style={styles.selectedEmoji}>
                    {selectedMeal?.emoji ?? "🍽️"}
                  </Text>
                  <Text style={styles.selectedTitle} numberOfLines={1}>
                    {selectedMeal?.title}
                  </Text>
                </View>

                {hasSides ? (
                  <View style={styles.sideList}>
                    {sides.map((side, index) => (
                      <Pressable
                        key={`${side}-${index}`}
                        onPress={() => {
                          if (isSideDeleteMode && onRemoveSide) {
                            onRemoveSide(index);
                          }
                        }}
                        disabled={!isSideDeleteMode}
                        accessibilityRole={isSideDeleteMode ? "button" : "text"}
                        accessibilityLabel={
                          isSideDeleteMode
                            ? `Remove side ${side}`
                            : `Side ${side}`
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
                    onChangeText={setSideInput}
                    onSubmitEditing={handleSubmitSide}
                    placeholder="Add a side"
                    placeholderTextColor={theme.color.subtleInk}
                    autoCapitalize="words"
                    returnKeyType="done"
                    style={styles.sideInput}
                    accessibilityLabel="Add a side dish"
                  />
                  <Pressable
                    onPress={() => setSideDeleteMode((prev) => !prev)}
                    disabled={!hasSides}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isSideDeleteMode
                        ? "Exit side delete mode"
                        : "Delete sides"
                    }
                    style={({ pressed }) => [
                      styles.sideTrashButton,
                      pressed && hasSides && styles.sideTrashButtonPressed,
                      isSideDeleteMode && styles.sideTrashButtonActive,
                      !hasSides && styles.sideTrashButtonDisabled,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        isSideDeleteMode ? "trash-can" : "trash-can-outline"
                      }
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

                <Pressable
                  onPress={() => {
                    if (selectedMeal) {
                      onSelectMeal(selectedMeal);
                      onDismiss();
                    }
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Done adding sides"
                >
                  <Text style={styles.primaryButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>

                <View style={styles.searchRow}>
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={theme.color.subtleInk}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search meals"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.searchInput}
                    autoCapitalize="words"
                    accessibilityLabel="Search meals"
                    returnKeyType="search"
                  />
                </View>

                {filteredMeals.length === 0 ? (
                  <View style={[styles.emptyState, styles.filler]}>
                    <Text style={styles.emptyText}>
                      No meals match your search.
                    </Text>
                    <Text style={styles.emptyHelper}>
                      Try a different name or keyword.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredMeals}
                    keyExtractor={(item) => item.id}
                    ItemSeparatorComponent={() => (
                      <View style={styles.separator} />
                    )}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    style={styles.list}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => handleSelect(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${item.title}`}
                        style={({ pressed }) => [
                          styles.row,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text style={styles.rowEmoji}>
                          {item.emoji ?? "🍽️"}
                        </Text>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Pressable
                          onPress={() => handleSelect(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${item.title}`}
                          style={({ pressed }) => [
                            styles.rowIcon,
                            pressed && styles.rowIconPressed,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={18}
                            color={theme.color.ink}
                          />
                        </Pressable>
                      </Pressable>
                    )}
                  />
                )}
              </>
            )}
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
      paddingVertical: theme.space.xl,
      maxHeight: "90%",
      minHeight: "85%",
      flexShrink: 0,
      width: "100%",
    },
    body: {
      flex: 1,
      gap: theme.space.lg,
    },
    header: {
      gap: theme.space.xs / 2,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
    },
    searchInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    listContent: {
      paddingBottom: theme.space.lg,
      flexGrow: 1,
    },
    list: {
      flex: 1,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.cardOutline,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingVertical: theme.space.md,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowEmoji: {
      fontSize: 28,
    },
    rowTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignItems: "center",
      justifyContent: "center",
    },
    rowIconPressed: {
      opacity: 0.8,
    },
    emptyState: {
      paddingVertical: theme.space.xl,
      alignItems: "center",
      gap: theme.space.xs,
    },
    emptyText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    emptyHelper: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    filler: {
      flexGrow: 1,
    },
    sidesStep: {
      gap: theme.space.lg,
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    backButtonPressed: {
      opacity: 0.85,
    },
    stepTitle: {
      flex: 1,
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    headerSpacer: {
      width: 40,
    },
    selectedMeal: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    selectedEmoji: {
      fontSize: 36,
    },
    selectedTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    sidesSection: {
      gap: theme.space.sm,
      paddingTop: theme.space.md,
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
      borderWidth: StyleSheet.hairlineWidth + 1,
      borderColor: theme.color.subtleInk,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      backgroundColor: theme.color.surface,
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
    primaryButton: {
      marginTop: "auto",
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonPressed: {
      opacity: 0.85,
    },
    primaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
  });

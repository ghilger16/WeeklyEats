import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import { renderPin } from "../pins/renderPin";
import {
  MealSortBadgeType,
  MealSortDirection,
} from "../pins/types";

export type MealSortOption = {
  id: string;
  label: string;
  defaultDirection?: MealSortDirection;
  badgeType?: MealSortBadgeType;
};

export type MealSortSelection = {
  id: string;
  direction: MealSortDirection;
};

type SelectedSortState = {
  option: MealSortOption;
  direction: MealSortDirection;
};

type MealSearchInputProps = {
  value: string;
  onChangeText: (query: string) => void;
  placeholder?: string;
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  sortOptions?: MealSortOption[];
  sortTitle?: string;
  onSortChange?: (selection: MealSortSelection | null) => void;
  onFilterPress?: () => void;
};

const DEFAULT_SORT_OPTIONS: MealSortOption[] = [
  {
    id: "name",
    label: "Name",
    defaultDirection: "asc",
    badgeType: "default",
  },
  {
    id: "rating",
    label: "Rating",
    defaultDirection: "desc",
    badgeType: "default",
  },
  {
    id: "expense",
    label: "Expense",
    defaultDirection: "asc",
    badgeType: "expense",
  },
  {
    id: "dateAdded",
    label: "Date Added",
    defaultDirection: "desc",
    badgeType: "default",
  },
  {
    id: "difficulty",
    label: "Difficulty",
    defaultDirection: "easy",
    badgeType: "difficulty",
  },
  {
    id: "servedCount",
    label: "Served Count",
    defaultDirection: "desc",
    badgeType: "default",
  },
];

const MealSearchInputComponent = ({
  value,
  onChangeText,
  placeholder = "Search meals",
  onSubmitEditing,
  sortOptions,
  sortTitle = "Sort by",
  onSortChange,
  onFilterPress,
}: MealSearchInputProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isFocused, setFocused] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState<SelectedSortState | null>(
    null
  );
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<View | null>(null);

  const options =
    sortOptions && sortOptions.length > 0 ? sortOptions : DEFAULT_SORT_OPTIONS;

  useEffect(() => {
    const initial = options.find((option) => option.id === "dateAdded");
    if (!selectedSort && initial) {
      const direction = initial.defaultDirection ?? "desc";
      setSelectedSort({ option: initial, direction });
      onSortChange?.({ id: initial.id, direction });
      return;
    }
    if (!selectedSort) {
      return;
    }
    const nextOption = options.find(
      (option) => option.id === selectedSort.option.id
    );
    if (!nextOption) {
      setSelectedSort(null);
      onSortChange?.(null);
      return;
    }
    if (nextOption !== selectedSort.option) {
      setSelectedSort({
        option: nextOption,
        direction: selectedSort.direction,
      });
    }
  }, [options, onSortChange, selectedSort]);

  const openDropdown = () => {
    if (!containerRef.current) {
      return;
    }
    setDropdownPosition(null);
    containerRef.current.measureInWindow((x, y, width, height) => {
      const windowWidth = Dimensions.get("window").width;
      const dropdownWidth = Math.max(width, 220);
      const clampedLeft = Math.max(
        theme.space.md,
        Math.min(x, windowWidth - dropdownWidth - theme.space.md)
      );
      setDropdownPosition({
        top: y + height + theme.space.xs,
        left: clampedLeft,
        width: dropdownWidth,
      });
      setDropdownOpen(true);
    });
  };

  const handleToggleDropdown = () => {
    if (isDropdownOpen) {
      setDropdownOpen(false);
    } else {
      openDropdown();
      onFilterPress?.();
    }
  };

  const handleCloseDropdown = () => {
    setDropdownOpen(false);
    setDropdownPosition(null);
  };

  const getOptionCycle = useCallback(
    (option: MealSortOption): MealSortDirection[] => {
      if (option.badgeType === "difficulty") {
        return ["easy", "medium", "hard"];
      }
      if (option.badgeType === "expense") {
        return ["cheap", "mediumCost", "expensive"];
      }
      return ["asc", "desc"];
    },
    []
  );

  const getInitialDirection = useCallback(
    (option: MealSortOption): MealSortDirection => {
      if (option.defaultDirection) {
        return option.defaultDirection;
      }
      const cycle = getOptionCycle(option);
      return cycle[0];
    },
    [getOptionCycle]
  );

  const getNextDirection = useCallback(
    (option: MealSortOption, current: MealSortDirection): MealSortDirection => {
      const cycle = getOptionCycle(option);
      const index = cycle.indexOf(current);
      if (index === -1) {
        return cycle[0];
      }
      return cycle[(index + 1) % cycle.length];
    },
    [getOptionCycle]
  );

  const handleSelectOption = (option: MealSortOption) => {
    const nextDirection = getInitialDirection(option);

    setSelectedSort({
      option,
      direction: nextDirection,
    });
    setDropdownOpen(false);
    setDropdownPosition(null);
    onSortChange?.({ id: option.id, direction: nextDirection });
  };

  const handleToggleSelectedDirection = useCallback(() => {
    if (!selectedSort) {
      return;
    }
    const option =
      options.find((candidate) => candidate.id === selectedSort.option.id) ??
      selectedSort.option;
    const nextDirection = getNextDirection(option, selectedSort.direction);
    setSelectedSort({
      option,
      direction: nextDirection,
    });
    onSortChange?.({ id: option.id, direction: nextDirection });
  }, [getNextDirection, onSortChange, options, selectedSort]);

  const badgeText = useMemo(() => {
    if (!selectedSort) {
      return null;
    }
    return selectedSort.option.label;
  }, [selectedSort]);

  return (
    <View
      style={styles.wrapper}
      ref={(node) => {
        containerRef.current = node;
      }}
    >
      <FlexGrid.Row
        alignItems="center"
        style={[styles.container, isFocused && styles.containerFocused]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.color.subtleInk}
          style={styles.input}
          returnKeyType="search"
          onFocus={() => {
            setFocused(true);
            handleCloseDropdown();
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          clearButtonMode="while-editing"
          accessibilityLabel="Search meals"
        />
        <FlexGrid.Row alignItems="center" style={styles.trailingContent}>
          {selectedSort && badgeText && !isFocused ? (
            <Pressable
              onPress={handleToggleSelectedDirection}
              style={({ pressed }) => [
                styles.sortBadge,
                pressed && styles.sortBadgePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${selectedSort.option.label} sort direction`}
            >
              <FlexGrid.Row alignItems="center" style={styles.sortBadgeContent}>
                <Text style={styles.sortBadgeText}>{badgeText}</Text>
                {renderPin({
                  context: "sort",
                  badgeType: selectedSort.option.badgeType,
                  direction: selectedSort.direction,
                  color: theme.color.ink,
                  size: "badge",
                  theme,
                })}
              </FlexGrid.Row>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.sortButton,
              pressed && styles.sortButtonPressed,
            ]}
            onPress={handleToggleDropdown}
            accessibilityRole="button"
            accessibilityLabel="Open meal sort options"
            accessibilityState={{ expanded: isDropdownOpen }}
            accessibilityHint="Choose how meals should be sorted"
            hitSlop={theme.space.xs}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={20}
              color={theme.color.ink}
            />
          </Pressable>
        </FlexGrid.Row>
      </FlexGrid.Row>
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDropdown}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCloseDropdown}
            accessibilityRole="button"
            accessibilityLabel="Dismiss sort options"
          />
          {dropdownPosition ? (
            <View
              style={[
                styles.modalDropdown,
                {
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                },
              ]}
            >
              <FlexGrid.Row alignItems="center" style={styles.dropdownHeader}>
                <MaterialCommunityIcons
                  name="swap-vertical"
                  size={16}
                  color={theme.color.subtleInk}
                />
                <Text style={styles.dropdownHeaderText}>{sortTitle}</Text>
              </FlexGrid.Row>
              {options.map((option) => {
                const isSelected = selectedSort?.option.id === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectOption(option)}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && styles.dropdownItemPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Sort by ${option.label}`}
                  >
                    <FlexGrid.Row
                      alignItems="center"
                      style={styles.dropdownItemContent}
                    >
                      <View style={styles.dropdownItemCheck}>
                        {isSelected ? (
                          <MaterialCommunityIcons
                            name="check"
                            size={18}
                            color={theme.color.accent}
                          />
                        ) : null}
                      </View>
                      <View style={styles.dropdownItemTextGroup}>
                        <Text style={styles.dropdownItemLabel}>
                          {option.label}
                        </Text>
                      </View>
                      <View style={styles.dropdownItemArrow}>
                        {isSelected && selectedSort ? (
                          renderPin({
                            context: "sort",
                            badgeType: option.badgeType,
                            direction: selectedSort.direction,
                            color: theme.color.accent,
                            size: "menu",
                            theme,
                          })
                        ) : null}
                      </View>
                    </FlexGrid.Row>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrapper: {
      position: "relative",
      zIndex: 1,
    },
    container: {
      height: theme.component.input.height,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingLeft: theme.space.md,
      paddingRight: theme.space.xs,
    },
    containerFocused: {
      borderColor: theme.color.accent,
    },
    input: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.regular,
      paddingVertical: 0,
      marginRight: theme.space.sm,
    },
    trailingContent: {
      gap: theme.space.sm,
      alignItems: "center",
    },
    sortBadge: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    sortBadgePressed: {
      opacity: 0.85,
    },
    sortBadgeContent: {
      gap: theme.space.xs,
      alignItems: "center",
    },
    sortBadgeText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sortButton: {
      width: theme.component.input.height - theme.space.xs,
      height: theme.component.input.height - theme.space.xs,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    sortButtonPressed: {
      opacity: 0.8,
    },
    modalRoot: {
      flex: 1,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    modalDropdown: {
      position: "absolute",
      zIndex: 1,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingVertical: theme.space.xs,
      shadowColor: "#000000",
      shadowOpacity: theme.mode === "dark" ? 0.35 : 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
      elevation: theme.elevation.modal,
    },
    dropdownHeader: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      gap: theme.space.sm,
    },
    dropdownHeaderText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    dropdownItem: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
    },
    dropdownItemPressed: {
      backgroundColor: theme.color.surfaceAlt,
    },
    dropdownItemContent: {
      alignItems: "center",
      flex: 1,
      gap: theme.space.sm,
    },
    dropdownItemCheck: {
      width: 20,
      alignItems: "center",
    },
    dropdownItemTextGroup: {
      flex: 1,
      justifyContent: "center",
    },
    dropdownItemLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    dropdownItemArrow: {
      width: 24,
      alignItems: "center",
      justifyContent: "center",
    },
  });

const MealSearchInput = memo(MealSearchInputComponent);

export default MealSearchInput;

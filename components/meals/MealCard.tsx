import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";

type MealCardProps = {
  mealId?: string;
  onClose: () => void;
};

const ingredientChips = ["Chicken", "Broccoli", "Ginger"];

export default function MealCard({ mealId, onClose }: MealCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = mealId ? "Edit Meal" : "Add Meal";

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoid}
      >
        <FlexGrid gutterWidth={theme.space.lg} gutterHeight={theme.space.md}>
          <FlexGrid.Row alignItems="center" wrap={false}>
            <FlexGrid.Col grow={0}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onClose}
                style={styles.backButton}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={24}
                  color={theme.color.subtleInk}
                />
              </Pressable>
            </FlexGrid.Col>
            <FlexGrid.Col grow={1}>
              <Text style={styles.headerTitle}>{title}</Text>
            </FlexGrid.Col>
          </FlexGrid.Row>
        </FlexGrid>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meal Title</Text>
            <TextInput
              placeholder="e.g. Chicken Stir Fry"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.input}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recipe Link</Text>
            <View style={styles.linkInput}>
              <MaterialCommunityIcons
                name="link-variant"
                size={18}
                color={theme.color.subtleInk}
              />
              <TextInput
                placeholder="Paste recipe URL"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.linkTextInput}
              />
            </View>
          </View>

          <View style={styles.section}>
            <FlexGrid gutterWidth={theme.space.sm}>
              <FlexGrid.Row alignItems="center" justifyContent="space-between">
                <FlexGrid.Col grow={1}>
                  <Text style={styles.sectionLabel}>Key Ingredients</Text>
                </FlexGrid.Col>
                <FlexGrid.Col grow={0}>
                  <Pressable style={styles.addIngredientButton}>
                    <Text style={styles.addIngredientText}>Add Ingredient</Text>
                  </Pressable>
                </FlexGrid.Col>
              </FlexGrid.Row>
              <FlexGrid.Row wrap alignItems="center">
                {ingredientChips.map((chip) => (
                  <FlexGrid.Col key={chip} grow={0}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{chip}</Text>
                    </View>
                  </FlexGrid.Col>
                ))}
              </FlexGrid.Row>
            </FlexGrid>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Difficulty</Text>
            <View style={styles.sliderTrack}>
              <View style={styles.sliderFill} />
              <View style={styles.sliderThumb} />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Easy</Text>
              <Text style={styles.sliderLabelText}>Hard</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Expense</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, styles.sliderFillExpense]} />
              <View style={[styles.sliderThumb, styles.sliderThumbExpense]} />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Cheap</Text>
              <Text style={styles.sliderLabelText}>Pricey</Text>
            </View>
          </View>

          <View style={styles.section}>
            <FlexGrid.Row alignItems="center" justifyContent="space-between">
              <FlexGrid.Col grow={1}>
                <Text style={styles.sectionLabel}>Lock every Tuesday?</Text>
              </FlexGrid.Col>
              <FlexGrid.Col grow={0}>
                <View style={styles.switchShell}>
                  <View style={styles.switchDot} />
                </View>
              </FlexGrid.Col>
            </FlexGrid.Row>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.saveButton}>
            <Text style={styles.saveText}>Save Meal</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    keyboardAvoid: {
      flex: 1,
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
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    scrollContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"],
      gap: theme.space["2xl"],
    },
    section: {
      gap: theme.space.md,
    },
    sectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.lg,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    linkInput: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      gap: theme.space.md,
    },
    linkTextInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    addIngredientButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: 6,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    addIngredientText: {
      color: theme.color.link,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    chip: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: 6,
      marginBottom: theme.space.sm,
    },
    chipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    sliderTrack: {
      height: theme.component.slider.trackHeight,
      borderRadius: theme.component.slider.trackHeight / 2,
      backgroundColor: theme.color.surfaceAlt,
      position: "relative",
      overflow: "hidden",
    },
    sliderFill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "50%",
      backgroundColor: theme.color.accent,
    },
    sliderFillExpense: {
      backgroundColor: theme.color.success,
    },
    sliderThumb: {
      position: "absolute",
      top:
        -(theme.component.slider.thumbSize / 2 -
          theme.component.slider.trackHeight / 2),
      left: "50%",
      width: theme.component.slider.thumbSize,
      height: theme.component.slider.thumbSize,
      borderRadius: theme.component.slider.thumbSize / 2,
      backgroundColor: theme.color.accent,
      borderWidth: 2,
      borderColor: theme.color.bg,
      transform: [{ translateX: -(theme.component.slider.thumbSize / 2) }],
    },
    sliderThumbExpense: {
      left: "70%",
      backgroundColor: theme.color.success,
    },
    sliderLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sliderLabelText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    switchShell: {
      width: 48,
      height: 28,
      borderRadius: 20,
      backgroundColor: theme.color.surfaceAlt,
      padding: 4,
      justifyContent: "center",
    },
    switchDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.color.subtleInk,
    },
    footer: {
      paddingHorizontal: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      paddingTop: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
      backgroundColor: theme.color.bg,
    },
    saveButton: {
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
  });

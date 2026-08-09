import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { Ingredient, IngredientType, Meal } from "../../types/meals";
import {
  retryIngredientSuggestions,
  suggestIngredientsForMealTitle,
} from "../../utils/mealCompletion";

type Props = {
  meal: Meal;
  onApply: (ingredients: Ingredient[]) => void;
};

const MealCompletionCard = ({ meal, onApply }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualKey, setManualKey] = useState("");
  const [manualPantry, setManualPantry] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (retry = false) => {
    setLoading(true);
    setHasError(false);
    const outcome = retry
      ? await retryIngredientSuggestions(meal.title)
      : await suggestIngredientsForMealTitle(meal.title);
    if (!outcome.ok) {
      setHasError(true);
      setLoading(false);
      return;
    }
    const next = [...outcome.data.keyIngredients, ...outcome.data.pantryStaples];
    setSuggestions(next);
    setSelected(new Set(next.map((item) => item.name.trim().toLowerCase())));
    setLoading(false);
  }, [meal.title]);

  useEffect(() => {
    load();
  }, [load]);

  const addManualIngredient = useCallback(
    (ingredientType: IngredientType) => {
      const value = ingredientType === "keyIngredient" ? manualKey : manualPantry;
      const name = value.trim();
      if (!name) return;
      const ingredient: Ingredient = {
        name,
        category: "other",
        ingredientType,
      };
      setSuggestions((current) => {
        if (current.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
          return current;
        }
        return [...current, ingredient];
      });
      setSelected((current) => new Set(current).add(name.toLowerCase()));
      if (ingredientType === "keyIngredient") setManualKey("");
      else setManualPantry("");
    },
    [manualKey, manualPantry]
  );

  const toggle = (name: string) => {
    const key = name.trim().toLowerCase();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderSuggestions = (ingredientType: IngredientType) => (
    <View style={styles.chipRow}>
      {suggestions
        .filter((item) => item.ingredientType === ingredientType)
        .map((ingredient) => {
          const isSelected = selected.has(ingredient.name.toLowerCase());
          const isPantry = ingredientType === "pantryStaple";
          return (
            <Pressable
              key={`${ingredientType}-${ingredient.name}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggle(ingredient.name)}
              style={({ pressed }) => [
                styles.chip,
                isPantry && styles.pantryChip,
                isSelected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name={isSelected ? "check" : "plus"}
                size={15}
                color={isSelected ? theme.color.accent : theme.color.subtleInk}
              />
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {ingredient.name}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );

  const selectedIngredients = suggestions.filter((item) =>
    selected.has(item.name.toLowerCase())
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.emojiWrap}><Text style={styles.emoji}>{meal.emoji}</Text></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{meal.title}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.status}>Missing ingredients</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.messageRow}>
          <ActivityIndicator size="small" color={theme.color.accent} />
          <Text style={styles.message}>Finding likely ingredients…</Text>
        </View>
      ) : (
        <>
          {hasError ? (
            <View style={styles.errorRow}>
              <Text style={styles.message}>We couldn’t suggest ingredients right now.</Text>
              <Pressable onPress={() => load(true)} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.prompt}>We think this meal might use:</Text>
          )}
          {renderSuggestions("keyIngredient")}
          <View style={styles.manualRow}>
            <TextInput
              value={manualKey}
              onChangeText={setManualKey}
              onSubmitEditing={() => addManualIngredient("keyIngredient")}
              placeholder="Add an ingredient"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.manualInput}
              returnKeyType="done"
            />
            <Pressable onPress={() => addManualIngredient("keyIngredient")} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={20} color={theme.color.accent} />
            </Pressable>
          </View>

          {suggestions.some((item) => item.ingredientType === "pantryStaple") ? (
            <View style={styles.pantrySection}>
              <Text style={styles.pantryTitle}>Pantry staples</Text>
              {renderSuggestions("pantryStaple")}
            </View>
          ) : null}
          <View style={styles.manualRow}>
            <TextInput
              value={manualPantry}
              onChangeText={setManualPantry}
              onSubmitEditing={() => addManualIngredient("pantryStaple")}
              placeholder="Add a pantry staple"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.manualInput}
              returnKeyType="done"
            />
            <Pressable onPress={() => addManualIngredient("pantryStaple")} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={20} color={theme.color.accent} />
            </Pressable>
          </View>
          <View style={styles.footer}>
            <Text style={styles.skip}>Not sure? You can skip this.</Text>
            <Pressable
              disabled={selectedIngredients.length === 0}
              onPress={() => onApply(selectedIngredients)}
              style={({ pressed }) => [
                styles.applyButton,
                selectedIngredients.length === 0 && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.applyText}>Add selected</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
};

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  card: { borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surface, padding: theme.space.lg, gap: theme.space.md },
  header: { flexDirection: "row", alignItems: "center", gap: theme.space.md },
  emojiWrap: { width: 58, height: 58, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceAlt },
  emoji: { fontSize: 34 },
  headerText: { flex: 1, gap: theme.space.xs },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  statusRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  statusDot: { width: 8, height: 8, borderRadius: theme.radius.full, backgroundColor: theme.color.warning },
  status: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  prompt: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: theme.space.xs, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceAlt, paddingHorizontal: theme.space.md, paddingVertical: 7 },
  pantryChip: { backgroundColor: theme.color.bg },
  chipSelected: { borderColor: theme.color.accent, backgroundColor: alpha(theme.color.accent, 0.12) },
  chipText: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  chipTextSelected: { color: theme.color.accent },
  pantrySection: { gap: theme.space.sm, paddingTop: theme.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  pantryTitle: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  manualRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  manualInput: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, backgroundColor: theme.color.surfaceAlt, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  addButton: { width: 38, height: 38, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: alpha(theme.color.accent, 0.12) },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space.md, marginTop: theme.space.xs },
  skip: { flex: 1, color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  applyButton: { minHeight: 42, borderRadius: theme.radius.md, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.lg },
  applyText: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  messageRow: { minHeight: 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  message: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  errorRow: { gap: theme.space.sm },
  retry: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
});

export default MealCompletionCard;

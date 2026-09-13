import { useRecipeAutoFill } from "../../../hooks/useRecipeAutoFill";
import { useFeatureFlag } from "../../../hooks/useFeatureFlags";
import { supportsRecipeAutoFill } from "../../../utils/recipeAutoFillCapability";
import { prepareRecipeMealDraft } from "../../../utils/recipeMealDraft";
import RecipeAutoFillProgress from "../../meals/RecipeAutoFillProgress";
import { createEmptyMealDraft, createMealId, Meal } from "../../../types/meals";
import { suggestEmojiForTitle } from "../../../utils/emojiCatalog";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { PLANNED_WEEK_DISPLAY_NAMES, PlannedWeekDayKey } from "../../../types/weekPlan";

type Props = {
  day: PlannedWeekDayKey;
  onBack: () => void;
  onSave: (title: string) => void;
  onImport?: (meal: Meal) => void;
  onExpandedLayout: () => void;
};

export default function InlineAddMealEditor({ day, onBack, onSave, onImport, onExpandedLayout }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"quick" | "recipe">("quick");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isImporting, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const activeRequest = useRef(0);
  const busy = useRef(false);
  const recipeFeatureEnabled = useFeatureFlag("recipeAutoFillEnabled");
  const canImport = Boolean(onImport) && recipeFeatureEnabled && supportsRecipeAutoFill();
  const { requestAutoFill, isLoading, error, resetAutoFill, clearError } = useRecipeAutoFill(recipeUrl.trim());
  // A collapsed day unmounts this editor; late responses must never save.
  useEffect(() => () => { activeRequest.current += 1; }, []);

  const backToQuickAdd = () => {
    activeRequest.current += 1;
    busy.current = false;
    setImporting(false);
    setImportError(null);
    resetAutoFill();
    setMode("quick");
  };

  const importRecipe = async () => {
    if (busy.current || !recipeUrl.trim() || !onImport) return;
    busy.current = true;
    const request = ++activeRequest.current;
    Keyboard.dismiss();
    setImporting(true);
    setImportError(null);
    try {
      const outcome = await requestAutoFill();
      if (request !== activeRequest.current || !outcome.ok) return;
      const imported = await prepareRecipeMealDraft(outcome.data);
      if (request !== activeRequest.current) return;
      if (!imported.title) {
        setImportError("We couldn’t find a meal title in that recipe. Try another link or use Quick Add.");
        return;
      }
      const now = new Date().toISOString();
      const draft = createEmptyMealDraft();
      onImport({
        ...draft,
        ...imported,
        id: createMealId(),
        emoji: suggestEmojiForTitle(imported.title) ?? draft.emoji,
        recipeUrl: recipeUrl.trim(),
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      if (request === activeRequest.current) setImportError("Auto-fill failed. Try again later.");
    } finally {
      if (request === activeRequest.current) {
        busy.current = false;
        setImporting(false);
      }
    }
  };
  const trimmedTitle = title.trim();
  const dayName = PLANNED_WEEK_DISPLAY_NAMES[day];

  const save = () => {
    if (!trimmedTitle) return;
    Keyboard.dismiss();
    onSave(trimmedTitle);
  };

  return (
    <View style={styles.content} onLayout={onExpandedLayout}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={mode === "recipe" ? backToQuickAdd : onBack}
          accessibilityRole="button"
          accessibilityLabel={mode === "recipe" ? "Back to Quick Add" : "Back to Quick Picks"}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.color.subtleInk} />
        </Pressable>
        <Text style={styles.title}>{mode === "recipe" ? "Add from Recipe Link" : "Add Meal"}</Text>
      </View>

      {mode === "quick" ? (
        <>
          <TextInput
            ref={inputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Meal title"
            placeholderTextColor={theme.color.subtleInk}
            accessibilityLabel={`New meal title for ${dayName}`}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
            style={styles.input}
          />

          <Pressable
            onPress={save}
            disabled={!trimmedTitle}
            accessibilityRole="button"
            accessibilityLabel={`Save and plan new meal for ${dayName}`}
            style={({ pressed }) => [
              styles.saveButton,
              !trimmedTitle && styles.saveButtonDisabled,
              pressed && trimmedTitle && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.color.ink} />
            <Text style={styles.saveText}>Save &amp; Plan</Text>
          </Pressable>
          {canImport ? (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} /><Text style={styles.helper}>OR</Text><View style={styles.divider} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => { resetAutoFill(); setImportError(null); setMode("recipe"); }}
                style={({ pressed }) => [styles.recipeRow, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="link-variant" size={26} color={theme.color.accent} />
                <View style={styles.recipeCopy}>
                  <Text style={styles.recipeTitle}>Add from Recipe Link</Text>
                  <Text style={styles.helper}>Paste a recipe link and we’ll fill in the details.</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.subtleInk} />
              </Pressable>
            </>
          ) : null}
        </>
      ) : (
        <>
          {isImporting ? <RecipeAutoFillProgress compact complete={!isLoading} /> : (
            <>
              <TextInput
                key="recipe-url"
                value={recipeUrl}
                onChangeText={(value) => { setRecipeUrl(value); clearError(); setImportError(null); }}
                placeholder="https://example.com/recipe"
                placeholderTextColor={theme.color.subtleInk}
                accessibilityLabel={`Recipe link for ${dayName}`}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => void importRecipe()}
                style={styles.input}
              />
              {importError || error ? <Text accessibilityRole="alert" style={styles.error}>{importError || error}</Text> : null}
              <Pressable
                onPress={() => void importRecipe()}
                disabled={!recipeUrl.trim()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.saveButton, !recipeUrl.trim() && styles.saveButtonDisabled, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="magic-staff" size={22} color={theme.color.ink} />
                <Text style={styles.saveText}>Auto Fill &amp; Plan</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={backToQuickAdd} accessibilityRole="button" style={styles.backToQuick}>
            <Text style={styles.helper}>Back to Quick Add</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  content: { paddingHorizontal: theme.space.sm, paddingBottom: theme.space.sm, gap: theme.space.md },
  titleRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: theme.space.md },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full },
  title: { flexShrink: 1, color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  input: { minHeight: 52, paddingHorizontal: theme.space.md, color: theme.color.ink, fontSize: theme.type.size.base, borderRadius: theme.radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surfaceAlt },
  saveButton: { minHeight: 52, marginTop: theme.space.sm, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: theme.space.md, marginTop: theme.space.sm },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  recipeRow: { flexDirection: "row", alignItems: "center", gap: theme.space.md, padding: theme.space.md, borderRadius: theme.radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline, backgroundColor: theme.color.surface },
  recipeCopy: { flex: 1, gap: theme.space.xs },
  recipeTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  helper: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  error: { color: theme.color.danger, fontSize: theme.type.size.sm },
  backToQuick: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72 },
});

import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  DEFAULT_MEAL_EMOJI,
  EMOJI_CATALOG,
  EmojiCatalogEntry,
  findEmojiMatches,
} from "../../utils/emojiCatalog";

type EmojiPickerModalProps = {
  visible: boolean;
  selectedEmoji?: string;
  suggestedEmoji?: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

const renderKey = (entry: EmojiCatalogEntry) => entry.emoji;

export const EmojiPickerModal = ({
  visible,
  selectedEmoji,
  suggestedEmoji,
  onPick,
  onClose,
}: EmojiPickerModalProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) {
      setQuery("");
    }
  }, [visible]);

  const results = useMemo(() => findEmojiMatches(query, 96), [query]);

  const data = useMemo(() => {
    if (query.trim()) {
      return results;
    }
    return EMOJI_CATALOG.slice(0, 96);
  }, [query, results]);

  const handlePick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      onClose();
    },
    [onClose, onPick]
  );

  const handleUseSuggestion = useCallback(() => {
    if (suggestedEmoji) {
      handlePick(suggestedEmoji);
    }
  }, [handlePick, suggestedEmoji]);

  const renderItem = useCallback(
    ({ item }: { item: EmojiCatalogEntry }) => {
      const isSelected = selectedEmoji === item.emoji;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.emojiButton,
            isSelected && styles.emojiButtonSelected,
            pressed && styles.emojiButtonPressed,
          ]}
          onPress={() => handlePick(item.emoji)}
          accessibilityLabel={item.label}
          accessibilityState={{ selected: isSelected }}
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
        </Pressable>
      );
    },
    [handlePick, selectedEmoji, styles]
  );

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose Meal Icon</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods, cuisines..."
            placeholderTextColor={theme.color.subtleInk}
            style={styles.searchInput}
            autoFocus={false}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {suggestedEmoji && suggestedEmoji !== selectedEmoji ? (
            <Pressable
              style={({ pressed }) => [
                styles.suggestionButton,
                pressed && styles.suggestionButtonPressed,
              ]}
              onPress={handleUseSuggestion}
              accessibilityRole="button"
              accessibilityLabel="Use suggested meal icon"
            >
              <Text style={styles.suggestionText}>
                Suggested: <Text style={styles.suggestionEmoji}>{suggestedEmoji}</Text>
              </Text>
            </Pressable>
          ) : null}
          <FlatList
            data={data}
            keyExtractor={renderKey}
            numColumns={6}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No emoji matches for &#34;{query}&#34;.
                </Text>
              </View>
            }
          />
          <Pressable
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.resetButtonPressed,
            ]}
            onPress={() => handlePick(DEFAULT_MEAL_EMOJI)}
          >
            <Text style={styles.resetText}>Use default plate</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.space.lg,
      paddingTop: theme.space.md,
      paddingBottom: theme.space["2xl"],
      maxHeight: "80%",
    },
    handle: {
      width: 48,
      height: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.cardOutline,
      alignSelf: "center",
      marginBottom: theme.space.md,
    },
    title: {
      fontSize: theme.type.size.title,
      color: theme.color.ink,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.sm,
      textAlign: "center",
    },
    searchInput: {
      height: 44,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      marginBottom: theme.space.md,
    },
    suggestionButton: {
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      marginBottom: theme.space.md,
      alignSelf: "flex-start",
    },
    suggestionButtonPressed: {
      opacity: 0.8,
    },
    suggestionText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    suggestionEmoji: {
      fontSize: theme.type.size.title,
    },
    listContent: {
      paddingBottom: theme.space.lg,
    },
    emojiButton: {
      width: "15.5%",
      aspectRatio: 1,
      margin: theme.space.xs / 2,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surface,
    },
    emojiButtonSelected: {
      borderWidth: 2,
      borderColor: theme.color.accent,
    },
    emojiButtonPressed: {
      opacity: 0.8,
    },
    emoji: {
      fontSize: 28,
    },
    emptyState: {
      paddingVertical: theme.space.lg,
      alignItems: "center",
    },
    emptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    resetButton: {
      marginTop: theme.space.md,
      alignSelf: "center",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    resetButtonPressed: {
      opacity: 0.85,
    },
    resetText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
  });

export default EmojiPickerModal;

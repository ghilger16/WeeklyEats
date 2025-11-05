import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WeeklyTheme } from "../../styles/theme";
import { useThemeController } from "../../providers/theme/ThemeController";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { deriveFamilyInitials } from "../../utils/familyInitials";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_TRANSLATE = SCREEN_HEIGHT;
export default function FamilyMembersModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members, addMember, removeMember, isLoading } = useFamilyMembers();
  const [inputValue, setInputValue] = useState("");
  const [isDeleteMode, setDeleteMode] = useState(false);
  const translateY = useRef(new Animated.Value(SHEET_MAX_TRANSLATE)).current;
  const closingRef = useRef(false);
  const initialsMap = useMemo(() => deriveFamilyInitials(members), [members]);
  const animateTo = useCallback(
    (toValue: number, duration: number, easing: (value: number) => number) =>
      new Promise<void>((resolve) => {
        Animated.timing(translateY, {
          toValue,
          duration,
          easing,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            resolve();
          }
        });
      }),
    [translateY]
  );
  const dismiss = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    await animateTo(
      SHEET_MAX_TRANSLATE,
      theme.motion.duration.normal,
      Easing.bezier(0.4, 0, 1, 1)
    );
    router.back();
  }, [animateTo, router, theme.motion.duration.normal]);
  useEffect(() => {
    closingRef.current = false;
    translateY.setValue(SHEET_MAX_TRANSLATE);
    animateTo(0, theme.motion.duration.slow, Easing.bezier(0, 0, 0.2, 1));
  }, [animateTo, theme.motion.duration.slow, translateY]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dx) < 20,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: async (_, gesture) => {
          const shouldDismiss =
            gesture.dy > SCREEN_HEIGHT * 0.18 || gesture.vy > 1.2;
          if (shouldDismiss) {
            await dismiss();
          } else {
            animateTo(
              0,
              theme.motion.duration.normal,
              Easing.bezier(0, 0, 0.2, 1)
            );
          }
        },
        onPanResponderTerminate: () => {
          animateTo(
            0,
            theme.motion.duration.normal,
            Easing.bezier(0, 0, 0.2, 1)
          );
        },
      }),
    [animateTo, dismiss, theme.motion.duration.normal, translateY]
  );
  const handleAddMember = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    await addMember(trimmed);
    setInputValue("");
  }, [addMember, inputValue]);
  const handleRemoveMember = useCallback(
    async (id: string) => {
      await removeMember(id);
    },
    [removeMember]
  );
  const toggleDeleteMode = useCallback(() => {
    setDeleteMode((prev) => !prev);
  }, []);
  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close family members"
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
      />
      <Animated.View
        style={[styles.sheetContainer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView edges={["bottom"]} style={styles.sheetSafeArea}>
          <View style={styles.handle} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.content}
          >
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>🧑‍🍳</Text>
              <Text style={styles.headerTitle}>Family Table</Text>
              <Text style={styles.headerSubtitle}>
                Add the people you cook for. We’ll keep their initials handy.
              </Text>
            </View>
            <View style={styles.chipSection}>
              {isLoading ? (
                <Text style={styles.emptyText}>Loading family members…</Text>
              ) : (
                <View style={styles.chipGrid}>
                  {members.map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => {
                        if (isDeleteMode) {
                          handleRemoveMember(member.id);
                        }
                      }}
                      accessibilityRole={isDeleteMode ? "button" : undefined}
                      accessibilityLabel={
                        isDeleteMode
                          ? `Remove ${member.name}`
                          : `Family member ${member.name}`
                      }
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && styles.chipPressed,
                        isDeleteMode && styles.chipDeleteMode,
                      ]}
                    >
                      <View style={styles.chipInitial}>
                        <Text style={styles.chipInitialText}>
                          {initialsMap[member.id] ?? "?"}
                        </Text>
                      </View>
                      <Text style={styles.chipName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {isDeleteMode ? (
                        <View style={styles.chipRemoveGlyph}>
                          <MaterialCommunityIcons
                            name="close"
                            size={16}
                            color={theme.color.subtleInk}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Add a family member"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleAddMember}
              />
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  toggleDeleteMode();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isDeleteMode ? "Exit delete mode" : "Delete family members"
                }
                style={({ pressed }) => [
                  styles.trashButton,
                  pressed && styles.trashButtonPressed,
                  isDeleteMode && styles.trashButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={isDeleteMode ? "trash-can" : "trash-can-outline"}
                  size={22}
                  color={isDeleteMode ? theme.color.ink : theme.color.subtleInk}
                />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheetContainer: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      overflow: "hidden",
    },
    sheetSafeArea: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.md,
      paddingBottom: theme.space["2xl"],
      gap: theme.space.lg,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    content: {
      gap: theme.space["2xl"],
    },
    header: {
      gap: theme.space.sm,
      alignItems: "center",
    },
    headerEmoji: {
      fontSize: 28,
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    headerSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    textInput: {
      flex: 1,
      height: theme.component.input.height,
      borderRadius: theme.component.input.radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingHorizontal: theme.component.input.paddingH,
      backgroundColor: theme.color.surfaceAlt,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    trashButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    trashButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    trashButtonPressed: {
      opacity: 0.85,
    },
    chipSection: {
      gap: theme.space.md,
      alignItems: "center",
    },
    emptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "flex-start",
      marginHorizontal: -theme.space.sm,
      rowGap: theme.space.sm,
      columnGap: theme.space.sm,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      marginHorizontal: theme.space.sm,
      marginVertical: theme.space.sm / 2,
      maxWidth: "48%",
      flexGrow: 0,
      flexShrink: 0,
    },
    chipPressed: {
      opacity: 0.9,
    },
    chipDeleteMode: {
      backgroundColor: theme.color.surface,
    },
    chipInitial: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    chipInitialText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    chipName: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      flexShrink: 1,
    },
    chipRemoveGlyph: {
      marginLeft: theme.space.xs,
      width: 24,
      height: 24,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
  });

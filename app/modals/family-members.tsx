import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardEvent,
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
import { memberColorPalette } from "../../components/meals/FamilyRatingIcons";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_TRANSLATE = SCREEN_HEIGHT;
export default function FamilyMembersModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members, addMember, removeMember, isLoading } = useFamilyMembers();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<TextInput | null>(null);
  const translateY = useRef(new Animated.Value(SHEET_MAX_TRANSLATE)).current;
  const closingRef = useRef(false);
  const initialsMap = useMemo(() => deriveFamilyInitials(members), [members]);
  const kbHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      const duration = (e as any).duration ?? 220;
      Animated.timing(kbHeight, {
        toValue: h,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false, // height layout change
      }).start();
    };
    const onHide = (e: KeyboardEvent) => {
      const duration = (e as any).duration ?? 200;
      Animated.timing(kbHeight, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    };

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [kbHeight]);

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
      inputRef.current?.focus();
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (
      members.some(
        (member) => member.name.trim().toLowerCase() === normalized
      )
    ) {
      setInputValue("");
      inputRef.current?.focus();
      return;
    }
    await addMember(trimmed);
    setInputValue("");
  }, [addMember, inputValue, members]);
  const handleRemoveMember = useCallback(
    async (id: string) => {
      await removeMember(id);
    },
    [removeMember]
  );
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

          <View style={styles.header}>
            <Text style={styles.headerEmoji}>👩‍🍳</Text>
            <Text style={styles.headerTitle}>Who are you cooking for?</Text>
            <Text style={styles.headerSubtitle}>
              Add your family so everyone can rate meals.
            </Text>
          </View>
          <View style={styles.familySection}>
            <Text style={styles.sectionLabel}>Your family</Text>
            {isLoading ? (
              <Text style={styles.emptyText}>Loading family members…</Text>
            ) : (
              <View style={styles.familyList}>
                {members.map((member, index) => (
                  <View
                    key={member.id}
                    style={styles.familyRow}
                  >
                    <View
                      style={[
                        styles.familyAvatar,
                        {
                          backgroundColor:
                            memberColorPalette[
                              index % memberColorPalette.length
                            ],
                        },
                      ]}
                    >
                      <Text style={styles.familyAvatarText}>
                        {initialsMap[member.id] ?? "?"}
                      </Text>
                    </View>
                    <Text style={styles.familyMemberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveMember(member.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${member.name}`}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.controlPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={19}
                        color={theme.color.subtleInk}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
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
                onPress={handleAddMember}
                accessibilityRole="button"
                accessibilityLabel="Add family member"
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.controlPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={22}
                  color={theme.color.accent}
                />
              </Pressable>
            </View>
          </View>
          <Animated.View style={{ height: kbHeight }} />
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
      fontSize: 36,
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    headerSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    inputRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    textInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.space.xs,
    },
    controlPressed: {
      opacity: 0.65,
    },
    familySection: {
      gap: theme.space.sm,
    },
    sectionLabel: {
      marginBottom: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    emptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    familyList: {
      gap: theme.space.xs,
    },
    familyRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    familyAvatar: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    familyAvatarText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    familyMemberName: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
  });

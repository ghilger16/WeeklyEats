import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TurboModuleRegistry, useWindowDimensions, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { requireOptionalNativeModule } from "expo-modules-core";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { useThemeController } from "../../providers/theme/ThemeController";
import { getCustomEmojiSource } from "../emoji/customEmojiRegistry";
import WeekShareCard, { SHARE_STYLES, SHARE_TITLES, WeekShareBackground } from "./WeekShareCard";

export default function ShareWeekModal({ days: currentDays, nextDays, onClose }: { days: WeekPlanDay[]; nextDays?: WeekPlanDay[]; onClose: () => void }) {
  const { theme } = useThemeController();
  const [week, setWeek] = useState<"current" | "next">("current");
  const hasWeekChoice = Boolean(nextDays?.some(day => day.meal) && currentDays.some(day => day.meal));
  const days = week === "next" && nextDays ? nextDays : currentDays;
  const imageKey = (key: string) => `${week}:${key}:${days.find(day => day.key === key)?.meal?.emoji ?? ""}`;
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 24, Math.max(220, (height - (hasWeekChoice ? 296 : 240)) / 1.25), 496);
  const pageWidth = cardWidth;
  const [selected, setSelected] = useState(0);
  const [titleIndex, setTitleIndex] = useState(0);
  const [showTitleHint, setShowTitleHint] = useState(true);
  const cycleTitle = () => {
    setShowTitleHint(false);
    setTitleIndex(index => (index + 1) % SHARE_TITLES.length);
  };
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [scrolling, setScrolling] = useState(false);
  const sharing = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const cardRef = useRef<View>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ x: selected * pageWidth, animated: false });
  }, [pageWidth, selected]);
  const customDays = days.filter(day => getCustomEmojiSource(day.meal?.emoji));
  const imagesReady = customDays.every(day => ready[imageKey(day.key)]);
  const share = async () => {
    if (sharing.current || scrolling || !imagesReady) return;
    sharing.current = true;
    setBusy(true);
    let uri: string | undefined;
    let releaseCapture: typeof import("react-native-view-shot").releaseCapture | undefined;
    try {
      if (!TurboModuleRegistry.get("RNViewShot") || !requireOptionalNativeModule("ExpoSharing")) {
        Alert.alert("App update needed", "Sharing images requires the latest Weekly Eats app build. You can still preview your week here.");
        return;
      }
      // These packages enforce native module availability at import time.
      // Load only after checking, so older app binaries can open the dashboard.
      const capture = require("react-native-view-shot") as typeof import("react-native-view-shot");
      const Sharing = require("expo-sharing") as typeof import("expo-sharing");
      releaseCapture = capture.releaseCapture;
      if (!await Sharing.isAvailableAsync()) throw new Error("Sharing is unavailable on this device.");
      const card = cardRef.current;
      if (!card) throw new Error("The preview is not ready yet.");
      uri = await capture.captureRef(card, { format: "png", quality: 1, width: 1080, height: 1350, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share Your Week" });
    } catch (error) {
      Alert.alert("Couldn’t share your week", error instanceof Error ? error.message : "Please try again.");
    } finally {
      if (uri) releaseCapture?.(uri);
      sharing.current = false;
      setBusy(false);
    }
  };
  const textColor = theme.color.ink;
  return <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={() => !busy && onClose()}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <View style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", padding: 20, gap: 12 }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 24, fontWeight: "700", color: textColor }}>Share Your Week</Text>
        <Pressable disabled={busy} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share preview" style={{ padding: 10, borderRadius: 24, backgroundColor: theme.color.surfaceAlt }}><MaterialCommunityIcons name="close" size={24} color={textColor} /></Pressable>
      </View>
      {hasWeekChoice && <View style={{ flexDirection: "row", marginHorizontal: 20, marginBottom: 28, padding: 4, borderRadius: 16, backgroundColor: theme.color.surfaceAlt }}>
        {(["current", "next"] as const).map(value => <Pressable key={value} disabled={busy} accessibilityRole="button" accessibilityLabel={value === "current" ? "Share current week" : "Share next week"} accessibilityState={{ selected: week === value, disabled: busy }} onPress={() => setWeek(value)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: week === value ? theme.color.bg : "transparent" }}>
          <Text style={{ color: week === value ? theme.color.accent : textColor, fontSize: 15, fontWeight: "600" }}>{value === "current" ? "Current Week" : "Next Week"}</Text>
        </Pressable>)}
      </View>}
      <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", alignSelf: "center", width: cardWidth }}>
          <View ref={cardRef} collapsable={false}>
            <WeekShareCard days={days} styleIndex={selected} width={cardWidth}
              title={SHARE_TITLES[titleIndex]} onTitlePress={busy ? undefined : cycleTitle}
              onImageLoad={key => { const id = imageKey(key); setReady(previous => previous[id] ? previous : ({ ...previous, [id]: true })); }}
              background={<ScrollView ref={scroll} testID="share-background-pager" horizontal pagingEnabled scrollEnabled={!busy} showsHorizontalScrollIndicator={false}
                onScrollBeginDrag={() => setScrolling(true)}
                onMomentumScrollEnd={({ nativeEvent }) => { setSelected(Math.max(0, Math.min(SHARE_STYLES.length - 1, Math.round(nativeEvent.contentOffset.x / pageWidth)))); setScrolling(false); }}
                onScrollEndDrag={({ nativeEvent }) => { if (Math.abs(nativeEvent.contentOffset.x / pageWidth - Math.round(nativeEvent.contentOffset.x / pageWidth)) < 0.01) { setSelected(Math.round(nativeEvent.contentOffset.x / pageWidth)); setScrolling(false); } }}
                style={{ width: cardWidth, height: cardWidth * 1.25 }}>
                {SHARE_STYLES.map((style, index) => <WeekShareBackground key={style.name} styleIndex={index} width={cardWidth} />)}
              </ScrollView>}
            />
          </View>
          {showTitleHint && <Pressable
            disabled={busy}
            onPress={cycleTitle}
            accessibilityRole="button"
            accessibilityLabel="Tap to cycle heading"
            hitSlop={8}
            style={{ position: "absolute", right: 16 * cardWidth / 360, top: 46 * cardWidth / 360, padding: 3 }}
          >
            <MaterialCommunityIcons name="gesture-tap" size={26 * cardWidth / 360} color={theme.color.accent} />
          </Pressable>}
        </View>
      </ScrollView>
      <View style={{ flexShrink: 0, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          {SHARE_STYLES.map((style, index) => <Pressable key={style.name} disabled={busy} accessibilityRole="button" accessibilityLabel={`${style.name} style`} accessibilityState={{ selected: index === selected }} onPress={() => { setSelected(index); setScrolling(false); scroll.current?.scrollTo({ x: index * pageWidth, animated: false }); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selected === index ? theme.color.accent : theme.color.border }} /></Pressable>)}
        </View>
        <Text accessibilityLiveRegion="polite" style={{ textAlign: "center", color: textColor, fontSize: 16, fontWeight: "600" }}>{SHARE_STYLES[selected]?.name}</Text>
      </View>
      <Pressable disabled={busy || scrolling || !imagesReady} onPress={share} accessibilityRole="button" accessibilityLabel="Share Week" accessibilityState={{ disabled: busy || scrolling || !imagesReady, busy }} style={{ marginHorizontal: 20, marginTop: 36, marginBottom: 4, minHeight: 54, borderRadius: 28, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center", opacity: busy || !imagesReady ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>Share Week</Text>}
      </Pressable>
    </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

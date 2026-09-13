import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { getCustomEmojiSource } from "../emoji/customEmojiRegistry";
import { shareDayDetails } from "./shareWeekData";

export const SHARE_TITLES = ["This Week's Dinner", "Family Dinner Plan", "What's For Dinner?", "Dinner Plan"] as const;

export const SHARE_STYLES = [
  { name: "Clean", background: "#FFFFFF", paper: "#FFFFFF", badge: "#F2EEED", line: "#ECE7E5" },
  { name: "Weekly Eats", background: "#FFF0F5", paper: "#FFF7FA", badge: "#FFD9E7", line: "#F4DCE6" },
  { name: "Warm", background: "#F5EBDD", paper: "#FFF9EF", badge: "#EDDFC9", line: "#E8DDCA" },
  { name: "Fridge", background: "#EDE4DB", paper: "#FFFDF7", badge: "#F8DCA3", line: "#ECE3D9" },
] as const;
export function WeekShareBackground({ styleIndex, width }: { styleIndex: number; width: number }) {
  const palette = SHARE_STYLES[styleIndex];
  const px = (n: number) => n * width / 360;
  return <View style={{ width, height: width * 1.25, padding: px(14), backgroundColor: palette.background }}>
    <View style={{ flex: 1, backgroundColor: palette.paper, borderRadius: px(16), borderWidth: styleIndex === 3 ? px(1) : 0, borderColor: palette.line }}>
      {styleIndex === 3 && <View style={{ position: "absolute", top: px(-8), width: px(90), height: px(16), alignSelf: "center", backgroundColor: "#F4B5C8", opacity: 0.8 }} />}
    </View>
  </View>;
}

export default function WeekShareCard({ days, styleIndex, width, onImageLoad, background, title = SHARE_TITLES[0], onTitlePress }: {
  days: WeekPlanDay[]; styleIndex: number; width: number; onImageLoad?: (key: string) => void; background?: ReactNode; title?: string; onTitlePress?: () => void;
}) {
  const palette = SHARE_STYLES[0];
  const scale = width / 360;
  const px = (n: number) => n * scale;
  const date = (value: Date) => value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const ink = "#142B40";
  return <View collapsable={false} style={{ width, height: width * 1.25, overflow: "hidden" }}>
    {background ?? <WeekShareBackground styleIndex={styleIndex} width={width} />}
    <View pointerEvents="box-none" testID="share-week-foreground" style={{ position: "absolute", top: px(14), bottom: px(14), left: px(14), right: px(14), padding: px(17) }}>
      <Pressable onPress={onTitlePress} disabled={!onTitlePress} accessibilityRole="button" accessibilityLabel={`Change heading: ${title}`} accessibilityHint="Cycles through four dinner plan titles">
      <Text allowFontScaling={false} style={{ color: ink, fontSize: px(27), fontWeight: "800", textAlign: "center", lineHeight: px(30), marginTop: px(4) }}>{title}</Text>
      </Pressable>
      <Text pointerEvents="none" allowFontScaling={false} style={{ color: "#526477", fontSize: px(12), textAlign: "center", marginTop: px(7), marginBottom: px(14) }}>{days[0] && date(days[0].plannedDate)} – {days[days.length - 1] && date(days[days.length - 1].plannedDate)}</Text>
      <View pointerEvents="none" style={{ flex: 1 }}>
        {days.map((day, index) => {
          const details = shareDayDetails(day);
          const source = getCustomEmojiSource(day.meal?.emoji);
          return <View key={`${day.plannedDateISO}:${day.key}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: px(9), borderBottomWidth: index === days.length - 1 ? 0 : px(0.6), borderColor: palette.line }}>
            <View style={{ width: px(38), height: px(27), borderRadius: px(7), alignItems: "center", justifyContent: "center", backgroundColor: palette.badge }}><Text allowFontScaling={false} style={{ color: ink, fontSize: px(10), fontWeight: "700" }}>{day.label.toUpperCase().slice(0, 3)}</Text></View>
            <View style={{ width: px(26), alignItems: "center" }}>
              {details.symbol ? <MaterialCommunityIcons name={details.symbol as "sync" | "silverware-fork-knife"} size={px(24)} color="#FF4B91" /> : source ? <Image source={source} onLoad={() => onImageLoad?.(day.key)} style={{ width: px(26), height: px(26) }} resizeMode="contain" /> : <Text allowFontScaling={false} style={{ fontSize: px(23) }}>{day.meal ? day.meal.emoji || "🍽️" : "—"}</Text>}
            </View>
            <View pointerEvents="none" style={{ flex: 1 }}>
              <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: ink, fontSize: px(13), fontWeight: "700" }}>{details.title}</Text>
              {!!details.subtitle && <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#526477", fontSize: px(9), marginTop: px(2) }}>{details.subtitle}</Text>}
            </View>
          </View>;
        })}
      </View>
      <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: px(5), paddingTop: px(14) }}><MaterialCommunityIcons name="heart" color="#FF4B91" size={px(17)} /><Text allowFontScaling={false} style={{ color: ink, fontSize: px(14), fontWeight: "800" }}>Weekly Eats</Text></View>
    </View>
  </View>;
}

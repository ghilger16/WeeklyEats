import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

// Local view-based artwork: deterministic, offline, and captured with the card.
export default function ShareBackgroundDecor({ name, width }: { name: string; width: number }) {
  const px = (n: number) => n * width / 360;
  const icon = (symbol: keyof typeof MaterialCommunityIcons.glyphMap, x: number, y: number, color: string, size = 20, angle = 0) =>
    <View key={`${symbol}-${x}-${y}`} style={{ position: "absolute", left: px(x), top: px(y), transform: [{ rotate: `${angle}deg` }] }}><MaterialCommunityIcons name={symbol} size={px(size)} color={color} /></View>;
  const leaves = <>{Array.from({ length: 7 }, (_, i) => icon("leaf", i % 2 ? 11 : -5, 5 + i * 15, i % 2 ? "#588343" : "#3D6838", 29, i % 2 ? 35 : -40))}</>;
  return <View pointerEvents="none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    {name === "Picnic" && <>
      {Array.from({ length: 18 }, (_, i) => <View key={`v${i}`} style={{ position: "absolute", left: px(i * 24), top: 0, bottom: 0, width: px(12), backgroundColor: "#EF8F91", opacity: 0.35 }} />)}
      {Array.from({ length: 20 }, (_, i) => <View key={`h${i}`} style={{ position: "absolute", top: px(i * 24), left: 0, right: 0, height: px(12), backgroundColor: "#EF8F91", opacity: 0.35 }} />)}
      {leaves}
      <View style={{ position: "absolute", right: px(2), top: px(225), transform: [{ rotate: "-20deg" }], alignItems: "center" }}>
        <View style={{ width: px(24), height: px(44), borderRadius: px(16), backgroundColor: "#C99D65", borderWidth: px(3), borderColor: "#D7B17F" }} />
        <View style={{ width: px(7), height: px(95), borderRadius: px(4), marginTop: px(-3), backgroundColor: "#C99D65" }} />
      </View>
    </>}
    {name === "Kitchen Tile" && <>
      {Array.from({ length: 8 }, (_, i) => <View key={`v${i}`} style={{ position: "absolute", left: px(i * 51), top: 0, bottom: 0, width: px(2), backgroundColor: "#DCD7CC" }} />)}
      {Array.from({ length: 10 }, (_, i) => <View key={`h${i}`} style={{ position: "absolute", top: px(i * 51), left: 0, right: 0, height: px(2), backgroundColor: "#DCD7CC" }} />)}
      {leaves}
      <View style={{ position: "absolute", right: px(-14), top: px(6), width: px(42), height: px(125), borderRadius: px(9), backgroundColor: "#BE8D59", borderWidth: px(3), borderColor: "#D6AE80", transform: [{ rotate: "-8deg" }] }} />
      <View style={{ position: "absolute", bottom: px(-16), left: px(-12), width: px(42), height: px(115), backgroundColor: "#E2EAF0", transform: [{ rotate: "-14deg" }] }}>
        {[8, 17, 26].map(x => <View key={x} style={{ position: "absolute", left: px(x), width: px(2), top: 0, bottom: 0, backgroundColor: "#8699AA" }} />)}
      </View>
      {icon("fruit-citrus", 320, 354, "#F4CA38", 48, -20)}
      {icon("leaf", 331, 337, "#689443", 27)}
    </>}
    {name === "Confetti" && <>
      {Array.from({ length: 24 }, (_, i) => {
        const x = i < 6 ? 12 + i * 63 : i % 2 ? 337 : 10;
        const y = i < 6 ? 10 + i % 2 * 7 : 55 + Math.floor((i - 6) / 2) * 43;
        return icon(i % 3 === 0 ? "heart" : i % 3 === 1 ? "star-four-points" : "circle", x, y, ["#F789B0", "#F6CD69", "#9DD9C5", "#C7A4E0"][i % 4], i % 3 === 2 ? 9 : 15, i * 23);
      })}
    </>}
    {name === "Fridge" && <>
      <View style={{ position: "absolute", left: px(8), top: px(73), width: px(10), height: px(174), borderRadius: px(5), backgroundColor: "#BDBDB4", borderLeftWidth: px(3), borderColor: "#FFFFFF", shadowColor: "#333333", shadowOpacity: 0.24, shadowRadius: 3, shadowOffset: { width: 2, height: 2 } }} />
      {icon("emoticon-happy", 13, 9, "#EDC444", 30, -12)}
      {icon("heart", 321, 14, "#F47C9F", 32, 18)}
      <View style={{ position: "absolute", left: px(-5), bottom: px(36), width: px(39), padding: px(5), backgroundColor: "#FFFEF5", transform: [{ rotate: "-9deg" }] }}>
        <Text allowFontScaling={false} style={{ color: "#4F5355", fontSize: px(8), fontStyle: "italic", textAlign: "center" }}>Good food{`\n`}Happy people</Text>
        <MaterialCommunityIcons name="heart" color="#FF83A9" size={px(12)} />
      </View>
      <View style={{ position: "absolute", right: px(-4), bottom: px(35), padding: px(4), paddingBottom: px(12), backgroundColor: "white", transform: [{ rotate: "9deg" }] }}>
        <View style={{ backgroundColor: "#B6D9D4", paddingVertical: px(8) }}><MaterialCommunityIcons name="flower" size={px(26)} color="#F6C851" /></View>
      </View>
    </>}
  </View>;
}

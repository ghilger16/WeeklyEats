import { Image, ImageStyle, StyleProp, Text, TextStyle } from "react-native";
import {
  getCustomEmojiSource,
  isCustomEmojiToken,
} from "./customEmojiRegistry";

type Props = {
  value?: string | null;
  size: number;
  fallback?: string;
  style?: StyleProp<TextStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export default function MealEmoji({
  value,
  size,
  fallback = "🍽️",
  style,
  imageStyle,
}: Props) {
  const source = getCustomEmojiSource(value);

  if (source) {
    return (
      <Image
        source={source}
        resizeMode="contain"
        fadeDuration={0}
        style={[{ width: size, height: size }, imageStyle]}
      />
    );
  }

  return <Text style={[{ fontSize: size }, style]}>{value || fallback}</Text>;
}

export const isCustomMealEmoji = (value?: string | null) =>
  isCustomEmojiToken(value);

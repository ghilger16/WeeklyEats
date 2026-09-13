import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, Linking } from "react-native";

export default function WidgetRecipeRedirect() {
  const { url } = useLocalSearchParams<{ url?: string | string[] }>();
  const router = useRouter();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const value = Array.isArray(url) ? url[0] : url;
    let recipeURL: URL;
    try {
      recipeURL = new URL(value ?? "");
      if (!["https:", "http:"].includes(recipeURL.protocol) || !recipeURL.hostname) {
        throw new Error("Invalid recipe URL");
      }
    } catch {
      router.replace("/(tabs)/week-dashboard");
      return;
    }
    void Linking.openURL(recipeURL.href)
      .catch(() => Alert.alert("Unable to open recipe", "Please try the recipe link from your meal."))
      .finally(() => router.replace("/(tabs)/week-dashboard"));
  }, [url, router]);

  return null;
}

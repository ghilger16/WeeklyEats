import { Stack } from "expo-router";
import { ThemeControllerProvider } from "../providers/theme/ThemeController";

export default function RootLayout() {
  return (
    <ThemeControllerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modals/theme-select"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeControllerProvider>
  );
}

import { Stack } from "expo-router";
import { ThemeControllerProvider } from "../providers/theme/ThemeController";
import { WeekStartControllerProvider } from "../providers/week-start/WeekStartController";

export default function RootLayout() {
  return (
    <ThemeControllerProvider>
      <WeekStartControllerProvider>
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
          <Stack.Screen
            name="modals/plan-week"
            options={{
              presentation: "modal",
              animation: "fade",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="modals/week-start"
            options={{
              presentation: "transparentModal",
              animation: "fade",
              headerShown: false,
            }}
          />
        </Stack>
      </WeekStartControllerProvider>
    </ThemeControllerProvider>
  );
}

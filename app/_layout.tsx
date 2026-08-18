import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  ThemeControllerProvider,
  useThemeController,
} from "../providers/theme/ThemeController";
import { WeekStartControllerProvider } from "../providers/week-start/WeekStartController";
import { FamilyMembersProvider } from "../providers/family-members/FamilyMembersProvider";
import { preloadCustomEmojiAssets } from "../components/emoji/customEmojiPreloader";

function RootStack() {
  const { theme } = useThemeController();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ contentStyle: { backgroundColor: theme.color.bg } }}
      />
      <Stack.Screen
        name="onboarding/index"
        options={{ contentStyle: { backgroundColor: theme.color.bg } }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ contentStyle: { backgroundColor: theme.color.bg } }}
      />
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
          presentation: "fullScreenModal",
          animation: "fade",
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.bg },
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
      <Stack.Screen
        name="modals/family-members"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="modals/rating-style"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="modals/streaksHistoryModal"
        options={{
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="modals/smartLevelModal"
        options={{
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    preloadCustomEmojiAssets().catch((error) => {
      console.warn("Unable to preload custom emoji assets", error);
    });
  }, []);

  return (
    <ThemeControllerProvider>
      <WeekStartControllerProvider>
        <FamilyMembersProvider>
          <RootStack />
        </FamilyMembersProvider>
      </WeekStartControllerProvider>
    </ThemeControllerProvider>
  );
}

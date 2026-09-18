import NotificationCoordinator from "../services/notifications/NotificationCoordinator";
import { Stack, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import {
  DatadogProvider,
  DdRum,
} from "@datadog/mobile-react-native";
import {
  ThemeControllerProvider,
  useThemeController,
} from "../providers/theme/ThemeController";
import { WeekStartControllerProvider } from "../providers/week-start/WeekStartController";
import { FamilyMembersProvider } from "../providers/family-members/FamilyMembersProvider";
import { preloadCustomEmojiAssets } from "../components/emoji/customEmojiPreloader";
import { datadogConfiguration } from "../services/datadog";
import { initializeAnalyticsIdentity } from "../services/analytics";

function DatadogRouteTracker() {
  const pathname = usePathname();
  const activeViewKey = useRef<string | null>(null);

  useEffect(() => {
    const viewKey = pathname || "/";
    const previousViewKey = activeViewKey.current;

    if (previousViewKey && previousViewKey !== viewKey) {
      void DdRum.stopView(previousViewKey);
    }

    activeViewKey.current = viewKey;
    void DdRum.startView(viewKey, viewKey);

    return () => {
      if (activeViewKey.current === viewKey) {
        void DdRum.stopView(viewKey);
        activeViewKey.current = null;
      }
    };
  }, [pathname]);

  return null;
}

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
      <Stack.Screen name="modals/notifications" options={{ presentation: "modal", headerShown: false }} />
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
        name="modals/family-profile"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="modals/subscription-required"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
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
    <DatadogProvider
      configuration={datadogConfiguration}
      onInitialization={() => void initializeAnalyticsIdentity()}
    >
      <DatadogRouteTracker />
      <ThemeControllerProvider>
        <WeekStartControllerProvider>
          <FamilyMembersProvider>
            <RootStack />
            <NotificationCoordinator />
          </FamilyMembersProvider>
        </WeekStartControllerProvider>
      </ThemeControllerProvider>
    </DatadogProvider>
  );
}

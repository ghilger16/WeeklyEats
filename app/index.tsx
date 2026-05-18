import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useThemeController } from "../providers/theme/ThemeController";
import { getOnboardingCompleted } from "../stores/onboardingStorage";

export default function Index() {
  const { theme } = useThemeController();
  const [isLoading, setLoading] = useState(true);
  const [isOnboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getOnboardingCompleted()
      .then((completed) => {
        if (isMounted) {
          setOnboardingComplete(completed);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.color.bg }]}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <Redirect href={isOnboardingComplete ? "/week-dashboard" : "/onboarding"} />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

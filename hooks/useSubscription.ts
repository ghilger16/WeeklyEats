import { useCallback, useEffect, useState } from "react";
import { Alert, AppState } from "react-native";
import { getFirstFullWeekPlanned } from "../stores/onboardingStorage";
import {
  SubscriptionDebugStatus,
  subscriptionService,
} from "../services/subscriptionService";

export type SubscriptionStatus =
  | "firstWeekFree"
  | "subscriptionRequired"
  | "subscribed";

export const resolveSubscriptionStatus = (
  hasPlannedFirstFullWeek: boolean,
  hasActiveSubscription: boolean,
): SubscriptionStatus => {
  if (hasActiveSubscription) return "subscribed";
  return hasPlannedFirstFullWeek
    ? "subscriptionRequired"
    : "firstWeekFree";
};

const showUnavailableMessage = () => {
  Alert.alert(
    "Subscriptions are not configured",
    "Add the RevenueCat public SDK key for this platform and create a new native build.",
  );
};

export const useSubscription = () => {
  const [status, setStatus] = useState<SubscriptionStatus>("firstWeekFree");
  const [renewalDateISO, setRenewalDateISO] = useState<string | undefined>();
  const [annualPriceString, setAnnualPriceString] = useState<string | undefined>();
  const [monthlyEquivalentPriceString, setMonthlyEquivalentPriceString] = useState<string | undefined>();
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [hasPlannedFirstFullWeek, snapshot, debugStatus] = await Promise.all([
      getFirstFullWeekPlanned(),
      subscriptionService.getSnapshot(),
      subscriptionService.getDebugStatus(),
    ]);
    const nextStatus = debugStatus ?? resolveSubscriptionStatus(
        hasPlannedFirstFullWeek,
        snapshot.isActive,
      );
    setStatus(nextStatus);
    setRenewalDateISO(snapshot.renewalDateISO);
    setAnnualPriceString(snapshot.annualPriceString);
    setMonthlyEquivalentPriceString(snapshot.monthlyEquivalentPriceString);
    setLoading(false);
    return nextStatus;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const runAction = useCallback(
    async (
      action: () => Promise<{
        available: boolean;
        succeeded: boolean;
        cancelled?: boolean;
        message?: string;
      }>,
    ) => {
      const result = await action();
      if (!result.available) showUnavailableMessage();
      else if (!result.succeeded && !result.cancelled && result.message) {
        Alert.alert("Weekly Eats Pro", result.message);
      }
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    status,
    renewalDateISO,
    annualPriceString,
    monthlyEquivalentPriceString,
    isLoading,
    refresh,
    purchaseAnnual: () => runAction(subscriptionService.purchaseAnnual),
    restorePurchases: () => runAction(subscriptionService.restorePurchases),
    manageSubscription: () => runAction(subscriptionService.manageSubscription),
    setDebugStatus: async (nextStatus: SubscriptionDebugStatus | null) => {
      await subscriptionService.setDebugStatus(nextStatus);
      await refresh();
    },
  };
};

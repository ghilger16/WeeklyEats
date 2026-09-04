import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
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
    "Subscriptions coming soon",
    "Purchase management will be available when subscriptions are enabled.",
  );
};

export const useSubscription = () => {
  const [status, setStatus] = useState<SubscriptionStatus>("firstWeekFree");
  const [renewalDateISO, setRenewalDateISO] = useState<string | undefined>();
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [hasPlannedFirstFullWeek, snapshot, debugStatus] = await Promise.all([
      getFirstFullWeekPlanned(),
      subscriptionService.getSnapshot(),
      subscriptionService.getDebugStatus(),
    ]);
    setStatus(debugStatus ?? resolveSubscriptionStatus(
        hasPlannedFirstFullWeek,
        snapshot.isActive,
      ));
    setRenewalDateISO(snapshot.renewalDateISO);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: () => Promise<{ available: boolean; succeeded: boolean }>) => {
      const result = await action();
      if (!result.available) showUnavailableMessage();
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    status,
    renewalDateISO,
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

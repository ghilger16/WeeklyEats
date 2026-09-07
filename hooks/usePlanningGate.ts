import { Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { SubscriptionStatus, useSubscription } from "./useSubscription";

export const requiresFullWeekSubscription = (status: SubscriptionStatus) =>
  status === "subscriptionRequired";

export const usePlanningGate = () => {
  const router = useRouter();
  const subscription = useSubscription();

  const requestFullWeekPlanning = useCallback(
    async (intent: string = "/modals/plan-week") => {
      const status = subscription.isLoading
        ? await subscription.refresh()
        : subscription.status;
      if (requiresFullWeekSubscription(status)) {
        router.push({
          pathname: "/modals/subscription-required",
          params: { planningIntent: intent },
        });
        return;
      }
      router.push(intent as Href);
    },
    [router, subscription.isLoading, subscription.refresh, subscription.status],
  );

  return {
    requestFullWeekPlanning,
    refreshPlanningEntitlement: subscription.refresh,
  };
};

import { Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { SubscriptionStatus, useSubscription } from "./useSubscription";

export const requiresFullWeekSubscription = (status: SubscriptionStatus) =>
  status === "subscriptionRequired";

export const usePlanningGate = () => {
  const router = useRouter();
  const subscription = useSubscription();

  const getPlanningAccessStatus = useCallback(
    () => subscription.isLoading
      ? subscription.refresh()
      : Promise.resolve(subscription.status),
    [subscription.isLoading, subscription.refresh, subscription.status],
  );

  const requestFullWeekPlanning = useCallback(
    async (intent: string = "/modals/plan-week") => {
      const status = await getPlanningAccessStatus();
      if (requiresFullWeekSubscription(status)) {
        router.push({
          pathname: "/modals/subscription-required",
          params: { planningIntent: intent },
        });
        return;
      }
      router.push(intent as Href);
    },
    [getPlanningAccessStatus, router],
  );

  return {
    requestFullWeekPlanning,
    getPlanningAccessStatus,
    refreshPlanningEntitlement: subscription.refresh,
  };
};

import { Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { useSubscription } from "./useSubscription";

export const usePlanningGate = () => {
  const router = useRouter();
  const subscription = useSubscription();

  const requestFullWeekPlanning = useCallback(
    (intent: Href = "/modals/plan-week") => {
      if (subscription.status === "subscriptionRequired") {
        router.push({
          pathname: "/modals/subscription-required",
          params: { planningIntent: String(intent) },
        });
        return;
      }
      router.push(intent);
    },
    [router, subscription.status],
  );

  return {
    requestFullWeekPlanning,
    refreshPlanningEntitlement: subscription.refresh,
  };
};

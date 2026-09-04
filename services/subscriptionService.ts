export type SubscriptionSnapshot = {
  isActive: boolean;
  renewalDateISO?: string;
};

export type SubscriptionActionResult = {
  available: boolean;
  succeeded: boolean;
};

// RevenueCat will replace the implementation behind this boundary later.
export const subscriptionService = {
  async getSnapshot(): Promise<SubscriptionSnapshot> {
    return { isActive: false };
  },

  async purchaseAnnual(): Promise<SubscriptionActionResult> {
    return { available: false, succeeded: false };
  },

  async restorePurchases(): Promise<SubscriptionActionResult> {
    return { available: false, succeeded: false };
  },

  async manageSubscription(): Promise<SubscriptionActionResult> {
    return { available: false, succeeded: false };
  },

  async getDebugStatus(): Promise<SubscriptionDebugStatus | null> {
    if (!__DEV__) return null;
    const value = await AsyncStorage.getItem(DEBUG_STATUS_KEY);
    return value === "firstWeekFree" ||
      value === "subscriptionRequired" ||
      value === "subscribed"
      ? value
      : null;
  },

  async setDebugStatus(status: SubscriptionDebugStatus | null): Promise<void> {
    if (!__DEV__) return;
    if (status) await AsyncStorage.setItem(DEBUG_STATUS_KEY, status);
    else await AsyncStorage.removeItem(DEBUG_STATUS_KEY);
  },
};
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscriptionDebugStatus =
  | "firstWeekFree"
  | "subscriptionRequired"
  | "subscribed";

const DEBUG_STATUS_KEY = "@weeklyeats/debugSubscriptionStatus";

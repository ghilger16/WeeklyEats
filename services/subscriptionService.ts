import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
} from "react-native-purchases";
import type { CustomerInfo, PurchasesError } from "react-native-purchases";

export type SubscriptionSnapshot = {
  isActive: boolean;
  renewalDateISO?: string;
};

export type SubscriptionActionResult = {
  available: boolean;
  succeeded: boolean;
  cancelled?: boolean;
  message?: string;
};

export type SubscriptionDebugStatus =
  | "firstWeekFree"
  | "subscriptionRequired"
  | "subscribed";

const DEBUG_STATUS_KEY = "@weeklyeats/debugSubscriptionStatus";
const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "weekly_eats_pro";
const OFFERING_ID = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim();

let configurationPromise: Promise<boolean> | null = null;

const getApiKey = () => {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  }
  return undefined;
};

const configure = async (): Promise<boolean> => {
  if (configurationPromise) return configurationPromise;

  configurationPromise = (async () => {
    const apiKey = getApiKey();
    if (!apiKey) return false;

    if (!(await Purchases.isConfigured())) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      Purchases.configure({ apiKey });
    }
    return true;
  })();

  return configurationPromise;
};

const snapshotFromCustomerInfo = (
  customerInfo: CustomerInfo,
): SubscriptionSnapshot => {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
  return {
    isActive: Boolean(entitlement),
    renewalDateISO: entitlement?.expirationDate ?? undefined,
  };
};

const resultFromError = (error: unknown): SubscriptionActionResult => {
  const purchasesError = error as Partial<PurchasesError>;
  const cancelled = purchasesError.userCancelled === true;
  return {
    available: true,
    succeeded: false,
    cancelled,
    message: cancelled
      ? undefined
      : purchasesError.message || "Something went wrong. Please try again.",
  };
};

const unavailableResult = (): SubscriptionActionResult => ({
  available: false,
  succeeded: false,
});

export const subscriptionService = {
  async getSnapshot(): Promise<SubscriptionSnapshot> {
    if (!(await configure())) return { isActive: false };

    try {
      return snapshotFromCustomerInfo(await Purchases.getCustomerInfo());
    } catch (error) {
      if (__DEV__) console.warn("Unable to load RevenueCat customer info", error);
      return { isActive: false };
    }
  },

  async purchaseAnnual(): Promise<SubscriptionActionResult> {
    if (!(await configure())) return unavailableResult();

    try {
      const offerings = await Purchases.getOfferings();
      const offering = OFFERING_ID
        ? offerings.all[OFFERING_ID]
        : offerings.current;
      const annualPackage = offering?.annual;

      if (!annualPackage) {
        return {
          available: true,
          succeeded: false,
          message:
            "The annual plan is not available right now. Please try again later.",
        };
      }

      const { customerInfo } = await Purchases.purchasePackage(annualPackage);
      return {
        available: true,
        succeeded: snapshotFromCustomerInfo(customerInfo).isActive,
      };
    } catch (error) {
      return resultFromError(error);
    }
  },

  async restorePurchases(): Promise<SubscriptionActionResult> {
    if (!(await configure())) return unavailableResult();

    try {
      const customerInfo = await Purchases.restorePurchases();
      const isActive = snapshotFromCustomerInfo(customerInfo).isActive;
      return {
        available: true,
        succeeded: isActive,
        message: isActive
          ? undefined
          : "No active Weekly Eats Pro subscription was found.",
      };
    } catch (error) {
      return resultFromError(error);
    }
  },

  async manageSubscription(): Promise<SubscriptionActionResult> {
    if (!(await configure())) return unavailableResult();

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (!customerInfo.managementURL) {
        return {
          available: true,
          succeeded: false,
          message: "No active subscription is available to manage.",
        };
      }

      await Linking.openURL(customerInfo.managementURL);
      return { available: true, succeeded: true };
    } catch (error) {
      return resultFromError(error);
    }
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

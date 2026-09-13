import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
} from "react-native-purchases";
import type { CustomerInfo, PurchasesError } from "react-native-purchases";
import { trackAction } from "./analytics";

export type SubscriptionSnapshot = {
  isActive: boolean;
  renewalDateISO?: string;
  annualPriceString?: string;
  monthlyEquivalentPriceString?: string;
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

const getAnnualPackage = async () => {
  const offerings = await Purchases.getOfferings();
  const offering = OFFERING_ID
    ? offerings.all[OFFERING_ID]
    : offerings.current;
  return offering?.annual ?? null;
};

export const subscriptionService = {
  async getSnapshot(): Promise<SubscriptionSnapshot> {
    if (!(await configure())) return { isActive: false };

    try {
      const [customerInfo, annualPackage] = await Promise.all([
        Purchases.getCustomerInfo(),
        getAnnualPackage().catch(() => null),
      ]);
      return {
        ...snapshotFromCustomerInfo(customerInfo),
        annualPriceString: annualPackage?.product.priceString,
        monthlyEquivalentPriceString:
          annualPackage?.product.pricePerMonthString ?? undefined,
      };
    } catch (error) {
      if (__DEV__) console.warn("Unable to load RevenueCat customer info", error);
      return { isActive: false };
    }
  },

  async purchaseAnnual(): Promise<SubscriptionActionResult> {
    if (!(await configure())) return unavailableResult();

    try {
      const annualPackage = await getAnnualPackage();

      if (!annualPackage) {
        trackAction("subscription_purchase_unavailable");
        return {
          available: true,
          succeeded: false,
          message:
            "The annual plan is not available right now. Please try again later.",
        };
      }

      trackAction("subscription_purchase_started", {
        package_type: "annual",
      });
      const { customerInfo } = await Purchases.purchasePackage(annualPackage);
      const succeeded = snapshotFromCustomerInfo(customerInfo).isActive;
      trackAction(
        succeeded
          ? "subscription_purchase_completed"
          : "subscription_purchase_not_activated",
        { package_type: "annual" },
      );
      return {
        available: true,
        succeeded,
      };
    } catch (error) {
      const purchasesError = error as Partial<PurchasesError>;
      trackAction(
        purchasesError.userCancelled
          ? "subscription_purchase_cancelled"
          : "subscription_purchase_failed",
        {
          package_type: "annual",
          error_code: purchasesError.code,
        },
      );
      return resultFromError(error);
    }
  },

  async restorePurchases(): Promise<SubscriptionActionResult> {
    if (!(await configure())) return unavailableResult();

    try {
      trackAction("subscription_restore_started");
      const customerInfo = await Purchases.restorePurchases();
      const isActive = snapshotFromCustomerInfo(customerInfo).isActive;
      trackAction("subscription_restore_completed", {
        entitlement_active: isActive,
      });
      return {
        available: true,
        succeeded: isActive,
        message: isActive
          ? undefined
          : "No active Weekly Eats Pro subscription was found.",
      };
    } catch (error) {
      const purchasesError = error as Partial<PurchasesError>;
      trackAction("subscription_restore_failed", {
        error_code: purchasesError.code,
      });
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

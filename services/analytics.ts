import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DdRum,
  DdSdkReactNative,
  RumActionType,
} from "@datadog/mobile-react-native";

const ANALYTICS_INSTALL_ID_KEY = "@weeklyeats/analytics-install-id";
const ANALYTICS_SCHEMA_VERSION = 1;

export type AnalyticsAttributes = Record<
  string,
  string | number | boolean | null | undefined
>;

const createAnonymousInstallId = () =>
  `install-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;

/**
 * Gives Datadog a stable, anonymous installation ID so weekly retention can be
 * measured without sending a person's name, email, meal titles, or ingredients.
 */
export const initializeAnalyticsIdentity = async () => {
  try {
    let installId = await AsyncStorage.getItem(ANALYTICS_INSTALL_ID_KEY);
    const isFirstOpen = !installId;
    if (!installId) {
      installId = createAnonymousInstallId();
      await AsyncStorage.setItem(ANALYTICS_INSTALL_ID_KEY, installId);
    }
    await DdSdkReactNative.setUserInfo({ id: installId });

    const context = {
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    };
    if (isFirstOpen) {
      await DdRum.addAction(
        RumActionType.CUSTOM,
        "app_first_open",
        context,
      );
    }
    await DdRum.addAction(
      RumActionType.CUSTOM,
      "app_session_started",
      context,
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("[analytics] Unable to initialize anonymous identity", error);
    }
  }
};

/** Records a content-free product event as a Datadog RUM custom action. */
export const trackAction = (
  name: string,
  attributes: AnalyticsAttributes = {},
) => {
  const context = Object.fromEntries(
    Object.entries({
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      ...attributes,
    }).filter(([, value]) => value !== undefined),
  );

  void DdRum.addAction(RumActionType.CUSTOM, name, context).catch((error) => {
    if (__DEV__) {
      console.warn(`[analytics] Unable to record ${name}`, error);
    }
  });
};

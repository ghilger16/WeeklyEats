import {
  DatadogProviderConfiguration,
  SdkVerbosity,
  TrackingConsent,
} from "@datadog/mobile-react-native";

const clientToken =
  process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN?.trim() ||
  "pub8e8bc06857d89556927c7bd28912adc1";
const rumApplicationId =
  process.env.EXPO_PUBLIC_DATADOG_RUM_APPLICATION_ID?.trim() ||
  "cb267779-9804-40b5-a67a-043f1efdaf3d";
const environment =
  process.env.EXPO_PUBLIC_DATADOG_ENV?.trim() || "prod";

export const datadogConfiguration = new DatadogProviderConfiguration(
  clientToken,
  environment,
  TrackingConsent.GRANTED,
  {
    service: "weekly-eats",
    site: "US5",
    verbosity: __DEV__ ? SdkVerbosity.WARN : undefined,
    rumConfiguration: {
      applicationId: rumApplicationId,
      trackInteractions: true,
      trackResources: true,
      trackErrors: true,
      nativeCrashReportEnabled: true,
      resourceTraceSampleRate: 100,
      sessionSampleRate: 100,
    },
    logsConfiguration: {},
    traceConfiguration: {},
  },
);

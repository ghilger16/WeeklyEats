# RevenueCat setup

Weekly Eats uses RevenueCat as the subscription source of truth while keeping
the existing in-app paywall UI.

## RevenueCat dashboard

1. Create a RevenueCat project.
2. Add an Apple App Store app with bundle ID `com.ghilger16.WeeklyEats`.
3. Add a Google Play app with package name `com.ghilger16.WeeklyEats` when the
   Android subscription is ready.
4. Create the annual auto-renewing subscription in App Store Connect (and Play
   Console for Android), then import it into RevenueCat.
5. Create an entitlement with identifier `weekly_eats_pro` and attach the annual product.
6. Create an Offering, attach the product using RevenueCat's `$rc_annual`
   package, and make the Offering current.

If the entitlement is not named `weekly_eats_pro`, set
`EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`. If an Offering other than the current
Offering should be used, set `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`.

## Build environment

Set these values for each EAS build profile (or as EAS environment variables):

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=weekly_eats_pro
```

These are RevenueCat **public SDK keys**, not secret API keys. Never put a
RevenueCat secret key in an `EXPO_PUBLIC_` variable.

After adding or updating the SDK, make a new native development or TestFlight
build. Expo Go can preview the subscription UI, but real store purchases require
a native build.

## Test checklist

- The current Offering contains an annual package.
- The annual product unlocks the `weekly_eats_pro` entitlement.
- A sandbox purchase changes the app state to `Weekly Eats Pro`.
- Cancelling the store purchase sheet leaves the paywall open without an error.
- Restore Purchases recovers the entitlement for the sandbox store account.
- Manage Subscription opens the store URL returned by RevenueCat.

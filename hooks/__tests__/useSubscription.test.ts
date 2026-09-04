import { resolveSubscriptionStatus } from "../useSubscription";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("resolveSubscriptionStatus", () => {
  it("allows the first full week before it has been planned", () => {
    expect(resolveSubscriptionStatus(false, false)).toBe("firstWeekFree");
  });

  it("requires a subscription after the first full week", () => {
    expect(resolveSubscriptionStatus(true, false)).toBe(
      "subscriptionRequired",
    );
  });

  it("prioritizes an active subscription", () => {
    expect(resolveSubscriptionStatus(true, true)).toBe("subscribed");
    expect(resolveSubscriptionStatus(false, true)).toBe("subscribed");
  });
});

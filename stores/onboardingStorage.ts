import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingAccount = {
  email: string;
  password: string;
};

const COMPLETED_KEY = "@weeklyeats/onboardingCompleted";
const ACCOUNT_KEY = "@weeklyeats/onboardingAccount";

export const getOnboardingCompleted = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(COMPLETED_KEY)) === "true";
  } catch (error) {
    console.warn("[onboardingStorage] Failed to read completion", error);
    return false;
  }
};

export const setOnboardingCompleted = async (
  completed: boolean
): Promise<void> => {
  try {
    await AsyncStorage.setItem(COMPLETED_KEY, completed ? "true" : "false");
  } catch (error) {
    console.warn("[onboardingStorage] Failed to write completion", error);
  }
};

export const getOnboardingAccount =
  async (): Promise<OnboardingAccount | null> => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<OnboardingAccount>;
      if (
        typeof parsed.email !== "string" ||
        typeof parsed.password !== "string"
      ) {
        return null;
      }

      return {
        email: parsed.email,
        password: parsed.password,
      };
    } catch (error) {
      console.warn("[onboardingStorage] Failed to read account", error);
      return null;
    }
  };

export const setOnboardingAccount = async (
  account: OnboardingAccount
): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch (error) {
    console.warn("[onboardingStorage] Failed to write account", error);
  }
};

export const onboardingCompletedStorageKey = COMPLETED_KEY;
export const onboardingAccountStorageKey = ACCOUNT_KEY;

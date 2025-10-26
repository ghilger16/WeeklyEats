import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
  WeeklyTheme,
  lightTheme,
  darkTheme,
  makeTheme,
  Mode,
} from "../../styles/theme";

const STORAGE_KEY = "weeklyeats.themePreference";

export type ThemePreference = Mode | "system";

type ThemeControllerValue = {
  theme: WeeklyTheme;
  preference: ThemePreference;
  setPreference: (mode: ThemePreference) => Promise<void>;
  isHydrated: boolean;
};

const ThemeControllerContext = createContext<ThemeControllerValue | undefined>(
  undefined
);

type Props = {
  children: ReactNode;
};

const resolveTheme = (
  preference: ThemePreference,
  systemScheme: ColorSchemeName
): WeeklyTheme => {
  const effective =
    preference === "system"
      ? systemScheme ?? Appearance.getColorScheme() ?? "dark"
      : preference;
  return effective === "light" ? lightTheme : darkTheme;
};

export const ThemeControllerProvider = ({ children }: Props) => {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const preferenceRef = useRef<ThemePreference>("system");
  const [theme, setTheme] = useState<WeeklyTheme>(
    makeTheme(Appearance.getColorScheme() === "light" ? "light" : "dark")
  );
  const [isHydrated, setHydrated] = useState(false);
  const systemSchemeRef = useRef<ColorSchemeName>(Appearance.getColorScheme());
  const appearanceListenerRef =
    useRef<ReturnType<typeof Appearance.addChangeListener>>(undefined);

  const applyTheme = useCallback(
    (mode: ThemePreference, systemScheme?: ColorSchemeName) => {
      const resolved = resolveTheme(
        mode,
        systemScheme ?? systemSchemeRef.current
      );
      setTheme(resolved);
    },
    []
  );

  const subscribeToSystem = useCallback(() => {
    if (appearanceListenerRef.current) {
      return;
    }
    appearanceListenerRef.current = Appearance.addChangeListener(
      (preferences) => {
        systemSchemeRef.current = preferences.colorScheme;
        if (preferenceRef.current === "system") {
          applyTheme("system", preferences.colorScheme);
        }
      }
    );
  }, [applyTheme]);

  const unsubscribeFromSystem = useCallback(() => {
    appearanceListenerRef.current?.remove();
  }, []);

  const setPreference = useCallback(
    async (mode: ThemePreference) => {
      preferenceRef.current = mode;
      setPreferenceState(mode);
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      if (mode === "system") {
        subscribeToSystem();
        applyTheme("system");
      } else {
        unsubscribeFromSystem();
        applyTheme(mode);
      }
    },
    [applyTheme, subscribeToSystem, unsubscribeFromSystem]
  );

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed =
          stored === "light" || stored === "dark" || stored === "system"
            ? (stored as ThemePreference)
            : "system";
        preferenceRef.current = parsed;
        setPreferenceState(parsed);
        if (parsed === "system") {
          subscribeToSystem();
        }
        applyTheme(parsed);
      } catch (error) {
        applyTheme("system");
      } finally {
        setHydrated(true);
      }
    };
    loadPreference();
    return () => {
      unsubscribeFromSystem();
    };
  }, [applyTheme, subscribeToSystem, unsubscribeFromSystem]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      isHydrated,
    }),
    [isHydrated, preference, setPreference, theme]
  );

  return (
    <ThemeControllerContext.Provider value={value}>
      {children}
    </ThemeControllerContext.Provider>
  );
};

export const useThemeController = (): ThemeControllerValue => {
  const context = useContext(ThemeControllerContext);
  if (!context) {
    throw new Error(
      "useThemeController must be used within a ThemeControllerProvider"
    );
  }
  return context;
};

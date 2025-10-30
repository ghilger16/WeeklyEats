import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PLANNED_WEEK_ORDER, PlannedWeekDayKey } from "../../types/weekPlan";

const STORAGE_KEY = "weeklyeats.weekStartDay";

const isValidWeekDay = (value: unknown): value is PlannedWeekDayKey =>
  typeof value === "string" &&
  (PLANNED_WEEK_ORDER as string[]).includes(value);

export const rotateWeekDayOrder = (
  startDay: PlannedWeekDayKey
): PlannedWeekDayKey[] => {
  const index = PLANNED_WEEK_ORDER.indexOf(startDay);
  if (index < 0) {
    return [...PLANNED_WEEK_ORDER];
  }
  return [
    ...PLANNED_WEEK_ORDER.slice(index),
    ...PLANNED_WEEK_ORDER.slice(0, index),
  ];
};

type WeekStartControllerValue = {
  startDay: PlannedWeekDayKey;
  orderedDays: PlannedWeekDayKey[];
  setStartDay: (day: PlannedWeekDayKey) => Promise<void>;
  isHydrated: boolean;
};

const WeekStartControllerContext =
  createContext<WeekStartControllerValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export const WeekStartControllerProvider = ({ children }: Props) => {
  const [startDay, setStartDayState] = useState<PlannedWeekDayKey>("mon");
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isValidWeekDay(stored)) {
          setStartDayState(stored);
        }
      } catch (error) {
        console.warn("[WeekStartController] Failed to hydrate", error);
      } finally {
        setHydrated(true);
      }
    };
    hydrate();
  }, []);

  const setStartDay = useCallback(async (day: PlannedWeekDayKey) => {
    setStartDayState(day);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, day);
    } catch (error) {
      console.warn("[WeekStartController] Failed to persist start day", error);
    }
  }, []);

  const orderedDays = useMemo(
    () => rotateWeekDayOrder(startDay),
    [startDay]
  );

  const value = useMemo(
    () => ({
      startDay,
      orderedDays,
      setStartDay,
      isHydrated,
    }),
    [isHydrated, orderedDays, setStartDay, startDay]
  );

  return (
    <WeekStartControllerContext.Provider value={value}>
      {children}
    </WeekStartControllerContext.Provider>
  );
};

export const useWeekStartController = (): WeekStartControllerValue => {
  const context = useContext(WeekStartControllerContext);
  if (!context) {
    throw new Error(
      "useWeekStartController must be used within a WeekStartControllerProvider"
    );
  }
  return context;
};

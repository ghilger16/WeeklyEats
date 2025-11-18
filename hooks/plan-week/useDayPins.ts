import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DayPinsPerWeek,
  DayPinsState,
  PlannedWeekDayKey,
  createEmptyDayPinsMap,
  normalizeDayPinsState,
} from "../../types/dayPins";
import {
  getStoredDayPins,
  setStoredDayPins,
} from "../../stores/dayPinsStorage";

type UseDayPinsArgs = {
  activeDay: PlannedWeekDayKey;
};

type UseDayPinsResult = {
  dayPinsMap: DayPinsPerWeek;
  activeDayPins: DayPinsState;
  handleDayPinsChange: (day: PlannedWeekDayKey, next: DayPinsState) => void;
  replaceDayPins: (next: DayPinsPerWeek) => void;
};

const useDayPins = ({ activeDay }: UseDayPinsArgs): UseDayPinsResult => {
  const [dayPinsMap, setDayPinsMap] = useState<DayPinsPerWeek>(() =>
    createEmptyDayPinsMap()
  );
  const pinsHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    getStoredDayPins().then((stored) => {
      if (!isMounted || pinsHydratedRef.current) {
        return;
      }
      pinsHydratedRef.current = true;
      setDayPinsMap(stored);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDayPinsChange = useCallback(
    (day: PlannedWeekDayKey, next: DayPinsState) => {
      pinsHydratedRef.current = true;
      setDayPinsMap((prev) => {
        const updated: DayPinsPerWeek = {
          ...prev,
          [day]: normalizeDayPinsState(next),
        };
        setStoredDayPins(updated).catch(() => {});
        return updated;
      });
    },
    []
  );

  const replaceDayPins = useCallback((next: DayPinsPerWeek) => {
    pinsHydratedRef.current = true;
    setDayPinsMap(next);
    setStoredDayPins(next).catch(() => {});
  }, []);

  const activeDayPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[activeDay]),
    [activeDay, dayPinsMap]
  );

  return {
    dayPinsMap,
    activeDayPins,
    handleDayPinsChange,
    replaceDayPins,
  };
};

export default useDayPins;

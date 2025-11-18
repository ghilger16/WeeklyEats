import { useCallback, useMemo, useState } from "react";
import {
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../../types/weekPlan";

type UsePlanSidesArgs = {
  activeDay: PlannedWeekDayKey;
};

type UsePlanSidesResult = {
  daySidesMap: Record<PlannedWeekDayKey, string[]>;
  activeDaySides: string[];
  handleAddSide: (day: PlannedWeekDayKey, side: string) => void;
  handleRemoveSide: (day: PlannedWeekDayKey, index: number) => void;
};

const createInitialSidesMap = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, string[]>>(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<PlannedWeekDayKey, string[]>
  );

const usePlanSides = ({ activeDay }: UsePlanSidesArgs): UsePlanSidesResult => {
  const [daySidesMap, setDaySidesMap] = useState<Record<PlannedWeekDayKey, string[]>>(
    createInitialSidesMap
  );

  const handleAddSide = useCallback((day: PlannedWeekDayKey, side: string) => {
    setDaySidesMap((prev) => {
      const existing = prev[day] ?? [];
      return {
        ...prev,
        [day]: [...existing, side],
      };
    });
  }, []);

  const handleRemoveSide = useCallback(
    (day: PlannedWeekDayKey, index: number) => {
      setDaySidesMap((prev) => {
        const existing = prev[day] ?? [];
        if (index < 0 || index >= existing.length) {
          return prev;
        }
        return {
          ...prev,
          [day]: existing.filter((_, idx) => idx !== index),
        };
      });
    },
    []
  );

  const activeDaySides = useMemo(() => daySidesMap[activeDay] ?? [], [activeDay, daySidesMap]);

  return {
    daySidesMap,
    activeDaySides,
    handleAddSide,
    handleRemoveSide,
  };
};

export default usePlanSides;

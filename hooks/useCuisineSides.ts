import { useEffect, useSyncExternalStore } from "react";
import { getCuisineSidesSnapshot, loadCuisineSides, subscribeCuisineSides } from "../stores/cuisineSidesStorage";

export const useCuisineSides = () => {
  const overrides = useSyncExternalStore(subscribeCuisineSides, getCuisineSidesSnapshot, getCuisineSidesSnapshot);
  useEffect(() => { void loadCuisineSides().catch(() => {}); }, []);
  return overrides;
};

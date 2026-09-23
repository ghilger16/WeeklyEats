export const sameSides = (left: string[], right: string[]) =>
  left.length === right.length && left.every((side, index) => side === right[index]);

export type AutoPlanSideState = {
  originalSides: string[];
  assignedSides: string[];
  manualSides: boolean;
};

/** Preserve user selections, including deliberately empty sides, through repeated retries. */
export const getAutoPlanSideState = (
  current: string[],
  preferredSide?: string,
  previous?: AutoPlanSideState,
): AutoPlanSideState => {
  const changed = previous ? !sameSides(current, previous.assignedSides) : false;
  const manualSides = previous ? previous.manualSides || changed : current.length > 0;
  return {
    originalSides: [...(changed ? current : previous?.originalSides ?? current)],
    assignedSides: manualSides ? [...current] : preferredSide ? [preferredSide] : [],
    manualSides,
  };
};

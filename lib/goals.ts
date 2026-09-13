import { colors } from "./theme";
import type { GoalType } from "./types";

export const GOAL_OPTIONS: { id: GoalType; label: string }[] = [
  { id: "reduce", label: "Reduce, then reach zero" },
  { id: "quit_completely", label: "Quit completely" },
  { id: "track_only", label: "Just track" },
];

// Short badge shown on the Home tile - lets a user change goal without
// opening the full habit detail screen.
export const GOAL_BADGES: Record<GoalType, { label: string; color: string }> = {
  reduce: { label: "Reduce", color: colors.goalYellow },
  quit_completely: { label: "Zero", color: colors.goalGreen },
  track_only: { label: "Track", color: colors.accentRed },
};

import { create } from "zustand";
import type { FrequencyType, GoalType, HabitKind, TrackingMethod } from "./types";

interface DraftState {
  // Where this creation flow started - lets the final "create habit" step
  // send the user back to the right place: Home for the main "+" flow,
  // back to focus-setup (to pick another area) when started from a chip there.
  origin: "home" | "focus_setup";
  kind: HabitKind | null;
  category: string | null;
  templateId: string | null;
  name: string;
  trackingMethod: TrackingMethod;
  targetAmount: number | null;
  unit: string | null;
  reason: string | null;
  frequencyType: FrequencyType;
  repeatDays: number[];
  reminderEnabled: boolean;
  reminderTime: string | null;
  hasCost: boolean;
  baselineQuantity: number | null;
  pricePerItem: number | null;
  goalType: GoalType | null;
  reduceDays: number | null;
  summaryTime: string | null;
  microtasks: string[];
  // Template-derived example numbers shown only as input placeholders (e.g.
  // "e.g. 5") - never written into the habit itself, so the user always has
  // to type their own value before Continue enables.
  suggestedTargetAmount: number | null;
  suggestedBaselineQuantity: number | null;
  suggestedPricePerItem: number | null;
  set: (patch: Partial<DraftState>) => void;
  reset: () => void;
}

const initial = {
  origin: "home" as "home" | "focus_setup",
  kind: null,
  category: null,
  templateId: null,
  name: "",
  trackingMethod: "amount" as TrackingMethod,
  targetAmount: null,
  unit: null,
  reason: null,
  frequencyType: "daily" as FrequencyType,
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  reminderEnabled: false,
  reminderTime: "20:30",
  hasCost: false,
  baselineQuantity: null,
  pricePerItem: null,
  goalType: null as GoalType | null,
  reduceDays: null as number | null,
  summaryTime: "22:00",
  microtasks: [] as string[],
  suggestedTargetAmount: null as number | null,
  suggestedBaselineQuantity: null as number | null,
  suggestedPricePerItem: null as number | null,
};

export const useDraftStore = create<DraftState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}));

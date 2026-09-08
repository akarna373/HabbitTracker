import { create } from "zustand";
import type { FrequencyType, GoalType, HabitKind, TrackingMethod } from "./types";

interface DraftState {
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
  summaryTime: string | null;
  microtasks: string[];
  set: (patch: Partial<DraftState>) => void;
  reset: () => void;
}

const initial = {
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
  summaryTime: "22:00",
  microtasks: [] as string[],
};

export const useDraftStore = create<DraftState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}));

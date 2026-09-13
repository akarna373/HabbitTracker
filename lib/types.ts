export type HabitKind = "good" | "quit";

export type TrackingMethod = "checkin" | "amount";

export type FrequencyType = "daily" | "weekdays" | "weekly" | "custom";

export type GoalType = "reduce_to_zero" | "reduce" | "maintain_zero";

export interface Habit {
  id: string;
  kind: HabitKind;
  category: string;
  templateId: string;
  name: string;
  trackingMethod: TrackingMethod;
  targetAmount: number | null;
  unit: string | null;
  reason: string | null;
  frequencyType: FrequencyType;
  repeatDays: number[]; // 0=Mon .. 6=Sun
  reminderEnabled: boolean;
  reminderTime: string | null; // "HH:mm"
  reminderNotificationId: string | null;
  hasCost: boolean;
  baselineQuantity: number | null;
  pricePerItem: number | null;
  goalType: GoalType | null;
  summaryTime: string | null; // "HH:mm", cost-tracked quit habits only
  summaryNotificationId: string | null;
  locationTrackingEnabled: boolean;
  createdAt: string;
  archivedAt: string | null;
}

export interface SmokeLocation {
  id: string;
  habitId: string;
  latitude: number;
  longitude: number;
  loggedAt: string; // ISO datetime
}

export interface Microtask {
  id: string;
  habitId: string;
  text: string;
  sortOrder: number;
}

export interface DailyLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  microtasksDone: string[]; // microtask ids completed this date
  reflection: string | null;
}

export interface NewHabitDraft {
  kind: HabitKind;
  category: string;
  templateId: string;
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
}

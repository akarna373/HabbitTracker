export type HabitKind = "good" | "quit";

export type TrackingMethod = "checkin" | "amount";

export type FrequencyType = "daily" | "weekdays" | "weekly" | "custom";

export type GoalType = "reduce" | "quit_completely" | "track_only";

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
  reduceDays: number | null; // cycle length for the "reduce" goal, days
  summaryTime: string | null; // "HH:mm", cost-tracked quit habits only
  summaryNotificationId: string | null;
  locationTrackingEnabled: boolean;
  backgroundLocationEnabled: boolean;
  attendedCount: number | null; // Attendance tracker: running total classes attended
  heldCount: number | null; // Attendance tracker: running total classes held
  attendanceTarget: number | null; // Attendance tracker: target %, e.g. 75
  examDate: string | null; // Exam countdown: ISO date "YYYY-MM-DD"
  checkupIntervalDays: number | null; // Doctor/checkup: remind every N days
  doseAmount: number | null; // Medication: e.g. 500
  doseUnit: string | null; // Medication: "mg" | "gm" | "drops" | "teaspoon" | custom text
  dosageFrequency: string | null; // Medication: "Once a day" | "Twice a day" | "Thrice a day" | custom text
  durationType: string | null; // Medication: "Daily" | "Week" | "Ten days" | "Month" | custom text
  medicineCategory: string | null; // Medication: free-text, e.g. "Heart", "Blood Pressure"
  medicationNotificationIds: string[] | null; // Medication: every scheduled dose reminder's id
  tabletsPerPacket: number | null; // Medication: optional stock tracking - packet size
  stockRemaining: number | null; // Medication: tablets left; null means stock tracking is off
  lowStockNotifiedAt: string | null; // Medication: ISO date the low-stock alert last fired, or null
  medicationStartDate: string | null; // Medication: ISO date the course actually begins - null defaults to createdAt
  totalTabletsBought: number | null; // Medication: running total ever purchased - the real stock denominator
  pillColor: string | null; // Medication: hex color for the packet visual - null defaults to theme pink
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
  amountB: number | null; // second value for a dual-metric habit (e.g. waist, diastolic)
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
  reduceDays: number | null;
  summaryTime: string | null;
  microtasks: string[];
  attendanceTarget: number | null;
  examDate: string | null;
  checkupIntervalDays: number | null;
  doseAmount: number | null;
  doseUnit: string | null;
  dosageFrequency: string | null;
  durationType: string | null;
  medicineCategory: string | null;
  tabletsPerPacket: number | null;
  startDate: string | null;
}

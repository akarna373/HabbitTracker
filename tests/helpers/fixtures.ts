import type { DailyLog, Habit } from "../../lib/types";

// Small builders shared by the savings tests.

// A timestamp for local noon on a date. Habits store createdAt/archivedAt as UTC instants
// while the app reasons in local dates, so fixtures are built from local noon: the same
// local date in every time zone (a fixed "T12:00:00Z" would be the next day at UTC+14).
export function localNoon(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export const PRICE = 25; // Rs 25 a stick
export const BASELINE = 4; // sticks a day

export function quitHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "smoke",
    kind: "quit",
    category: "quit",
    templateId: "smoking",
    name: "Smoking cigarettes",
    trackingMethod: "amount",
    targetAmount: null,
    unit: "sticks",
    reason: null,
    frequencyType: "daily",
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: false,
    reminderTime: null,
    reminderNotificationId: null,
    hasCost: true,
    baselineQuantity: BASELINE,
    pricePerItem: PRICE,
    goalType: "reduce",
    reduceDays: 14,
    summaryTime: null,
    summaryNotificationId: null,
    locationTrackingEnabled: false,
    backgroundLocationEnabled: false,
    attendedCount: null,
    heldCount: null,
    attendanceTarget: null,
    examDate: null,
    checkupIntervalDays: null,
    doseAmount: null,
    doseUnit: null,
    dosageFrequency: null,
    durationType: null,
    medicineCategory: null,
    medicationNotificationIds: null,
    tabletsPerPacket: null,
    stockRemaining: null,
    lowStockNotifiedAt: null,
    medicationStartDate: null,
    totalTabletsBought: null,
    pillColor: null,
    // Well before every date used in the tests.
    createdAt: localNoon("2026-08-01"),
    archivedAt: null,
    ...overrides,
  };
}

// A log recorded on purpose (the counter, "I stayed clean", a notification action).
export function log(date: string, amount: number, overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: `log-${date}`,
    habitId: "smoke",
    date,
    amount,
    amountB: null,
    microtasksDone: [],
    reflection: null,
    amountLogged: true,
    ...overrides,
  };
}

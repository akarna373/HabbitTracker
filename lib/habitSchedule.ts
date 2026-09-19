import { weekdayIndexMonFirst } from "./dates";
import type { Habit } from "./types";

// Small date/schedule helpers shared by the money code (lib/financialSummary.ts,
// lib/savingsLedger.ts). Pure: no React, no store, no clock.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30 and the like).
export function isRealISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// repeatDays is Monday-first (0=Mon..6=Sun), same convention as lib/dates.ts.
export function isHabitScheduledOn(habit: Pick<Habit, "repeatDays" | "frequencyType">, date: string): boolean {
  if (!isRealISODate(date)) return false;
  if (!Array.isArray(habit.repeatDays)) return habit.frequencyType === "daily";
  return habit.repeatDays.includes(weekdayIndexMonFirst(date));
}

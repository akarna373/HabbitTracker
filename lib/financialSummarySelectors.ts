import { todayISO } from "./dates";
import { computeFinancialSummary, type FinancialSummary } from "./financialSummary";
import { useStore } from "./store";
import type { DailyLog, Habit } from "./types";

// Store bridge for lib/financialSummary.ts. The summary is derived every time,
// never saved, but two things keep it from costing renders:
//
// 1. One cached result per (habits, logsByHabit, today) - however many
//    components ask, the maths runs once per store change, and asking twice for
//    the same state returns the very same object (zustand needs that from a
//    selector, or it warns about an uncached snapshot).
// 2. When the inputs did change but the money figures did not (a non-cost habit
//    was logged, a reflection was saved), the previous result object is handed
//    back, so subscribers do not re-render for an identical dashboard.

interface SummarySource {
  habits: Habit[];
  logsByHabit: Record<string, DailyLog[]>;
}

let cachedHabits: Habit[] | null = null;
let cachedLogs: Record<string, DailyLog[]> | null = null;
let cachedToday: string | null = null;
let cachedSummary: FinancialSummary | null = null;

// Plain JSON data with a fixed key order, so string equality is value equality.
function sameSummary(a: FinancialSummary, b: FinancialSummary): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function selectFinancialSummary(state: SummarySource): FinancialSummary {
  const today = todayISO();
  if (
    cachedSummary !== null &&
    cachedHabits === state.habits &&
    cachedLogs === state.logsByHabit &&
    cachedToday === today
  ) {
    return cachedSummary;
  }

  const next = computeFinancialSummary({ habits: state.habits, logsByHabit: state.logsByHabit, today });
  cachedHabits = state.habits;
  cachedLogs = state.logsByHabit;
  cachedToday = today;
  if (cachedSummary === null || !sameSummary(cachedSummary, next)) cachedSummary = next;
  return cachedSummary;
}

// Re-renders only when a money figure changes. The summary is recalculated on
// the next store change after midnight, not by a timer.
export function useFinancialSummary(): FinancialSummary {
  return useStore(selectFinancialSummary);
}

import { useMemo } from "react";
import { computeFinancialSummary, type FinancialSummary } from "./financialSummary";
import { useStore } from "./store";
import { useMinuteClock } from "./useMinuteClock";

// Store bridge for lib/financialSummary.ts. The summary is derived, never saved. It is
// rebuilt whenever anything it reads changes: a habit, a log (a tap in the app, or a
// notification action the store has re-read), the daily ledger, the calendar choice - or
// the local date, so it rolls over on its own without an app restart.
export function useFinancialSummary(): FinancialSummary {
  const habits = useStore((s) => s.habits);
  const archivedHabits = useStore((s) => s.archivedHabits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const ledger = useStore((s) => s.savingsLedger);
  const calendarType = useStore((s) => s.calendarType);
  const { today } = useMinuteClock();

  return useMemo(
    () => computeFinancialSummary({ habits, archivedHabits, logsByHabit, ledger, today, calendarType }),
    [habits, archivedHabits, logsByHabit, ledger, today, calendarType]
  );
}

// The one place that writes a deliberately recorded amount to daily_logs. The in-app
// counter, "I stayed clean today" and the notification actions (which run with no React
// tree mounted) all go through it, so every one of them also marks the row as
// amountLogged - a real report of consumption, as opposed to a placeholder row created
// by ticking a microtask or saving a reflection (see DailyLog in lib/types.ts).

// `any[]` (not `unknown[]`) so expo-sqlite's own database, whose parameter type is a
// union of bindable values, is accepted as-is.
export interface LogWriteDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAsync(sql: string, params: any[]): Promise<unknown>;
}

export async function upsertLoggedAmount(
  db: LogWriteDb,
  entry: { id: string; habitId: string; date: string; amount: number; amountB?: number | null }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection, amountLogged)
     VALUES (?,?,?,?,?,?,?,1)
     ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount, amountLogged = 1`,
    [entry.id, entry.habitId, entry.date, entry.amount, entry.amountB ?? null, "[]", null]
  );
}

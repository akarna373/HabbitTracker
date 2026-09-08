import { create } from "zustand";
import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { cancelNotification, scheduleDailyNotification } from "./notifications";
import type { DailyLog, Habit, Microtask, NewHabitDraft } from "./types";

interface HabitRow {
  id: string;
  kind: string;
  category: string;
  templateId: string;
  name: string;
  trackingMethod: string;
  targetAmount: number | null;
  unit: string | null;
  reason: string | null;
  frequencyType: string;
  repeatDays: string;
  reminderEnabled: number;
  reminderTime: string | null;
  reminderNotificationId: string | null;
  hasCost: number;
  baselineQuantity: number | null;
  pricePerItem: number | null;
  goalType: string | null;
  summaryTime: string | null;
  summaryNotificationId: string | null;
  createdAt: string;
  archivedAt: string | null;
}

function rowToHabit(row: HabitRow): Habit {
  return {
    ...row,
    kind: row.kind as Habit["kind"],
    trackingMethod: row.trackingMethod as Habit["trackingMethod"],
    frequencyType: row.frequencyType as Habit["frequencyType"],
    goalType: row.goalType as Habit["goalType"],
    repeatDays: JSON.parse(row.repeatDays),
    reminderEnabled: !!row.reminderEnabled,
    hasCost: !!row.hasCost,
  };
}

interface LogRow {
  id: string;
  habitId: string;
  date: string;
  amount: number;
  microtasksDone: string;
  reflection: string | null;
}

function rowToLog(row: LogRow): DailyLog {
  return { ...row, microtasksDone: JSON.parse(row.microtasksDone) };
}

interface StoreState {
  ready: boolean;
  habits: Habit[];
  microtasksByHabit: Record<string, Microtask[]>;
  logsByHabit: Record<string, DailyLog[]>;
  init: () => Promise<void>;
  createHabit: (draft: NewHabitDraft) => Promise<string>;
  deleteHabit: (habitId: string) => Promise<void>;
  incrementAmount: (habitId: string, date: string, delta: number) => Promise<void>;
  toggleMicrotask: (habitId: string, date: string, microtaskId: string) => Promise<void>;
  saveReflection: (habitId: string, date: string, text: string) => Promise<void>;
  setReminder: (habitId: string, enabled: boolean, time: string | null) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  habits: [],
  microtasksByHabit: {},
  logsByHabit: {},

  init: async () => {
    const db = await getDb();
    const habitRows = await db.getAllAsync<HabitRow>(
      "SELECT * FROM habits WHERE archivedAt IS NULL ORDER BY createdAt ASC"
    );
    const habits = habitRows.map(rowToHabit);

    const microtaskRows = await db.getAllAsync<Microtask>(
      "SELECT * FROM microtasks ORDER BY sortOrder ASC"
    );
    const microtasksByHabit: Record<string, Microtask[]> = {};
    for (const m of microtaskRows) {
      (microtasksByHabit[m.habitId] ??= []).push(m);
    }

    const logRows = await db.getAllAsync<LogRow>("SELECT * FROM daily_logs");
    const logsByHabit: Record<string, DailyLog[]> = {};
    for (const row of logRows) {
      (logsByHabit[row.habitId] ??= []).push(rowToLog(row));
    }

    set({ ready: true, habits, microtasksByHabit, logsByHabit });
  },

  createHabit: async (draft) => {
    const db = await getDb();
    const id = genId();
    const now = new Date().toISOString();

    let reminderNotificationId: string | null = null;
    if (draft.reminderEnabled && draft.reminderTime) {
      reminderNotificationId = await scheduleDailyNotification(
        draft.name,
        "A gentle reminder to check in today.",
        draft.reminderTime
      );
    }

    let summaryNotificationId: string | null = null;
    if (draft.hasCost && draft.summaryTime) {
      summaryNotificationId = await scheduleDailyNotification(
        "Your 10 PM summary",
        `See how today compared for ${draft.name}.`,
        draft.summaryTime
      );
    }

    await db.runAsync(
      `INSERT INTO habits (
        id, kind, category, templateId, name, trackingMethod, targetAmount, unit, reason,
        frequencyType, repeatDays, reminderEnabled, reminderTime, reminderNotificationId,
        hasCost, baselineQuantity, pricePerItem, goalType, summaryTime, summaryNotificationId,
        createdAt, archivedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      [
        id,
        draft.kind,
        draft.category,
        draft.templateId,
        draft.name,
        draft.trackingMethod,
        draft.targetAmount,
        draft.unit,
        draft.reason,
        draft.frequencyType,
        JSON.stringify(draft.repeatDays),
        draft.reminderEnabled ? 1 : 0,
        draft.reminderTime,
        reminderNotificationId,
        draft.hasCost ? 1 : 0,
        draft.baselineQuantity,
        draft.pricePerItem,
        draft.goalType,
        draft.summaryTime,
        summaryNotificationId,
        now,
      ]
    );

    const microtasks: Microtask[] = [];
    for (let i = 0; i < draft.microtasks.length; i++) {
      const text = draft.microtasks[i].trim();
      if (!text) continue;
      const microtaskId = genId();
      await db.runAsync(
        "INSERT INTO microtasks (id, habitId, text, sortOrder) VALUES (?,?,?,?)",
        [microtaskId, id, text, i]
      );
      microtasks.push({ id: microtaskId, habitId: id, text, sortOrder: i });
    }

    const habit: Habit = {
      id,
      kind: draft.kind,
      category: draft.category,
      templateId: draft.templateId,
      name: draft.name,
      trackingMethod: draft.trackingMethod,
      targetAmount: draft.targetAmount,
      unit: draft.unit,
      reason: draft.reason,
      frequencyType: draft.frequencyType,
      repeatDays: draft.repeatDays,
      reminderEnabled: draft.reminderEnabled,
      reminderTime: draft.reminderTime,
      reminderNotificationId,
      hasCost: draft.hasCost,
      baselineQuantity: draft.baselineQuantity,
      pricePerItem: draft.pricePerItem,
      goalType: draft.goalType,
      summaryTime: draft.summaryTime,
      summaryNotificationId,
      createdAt: now,
      archivedAt: null,
    };

    set((s) => ({
      habits: [...s.habits, habit],
      microtasksByHabit: { ...s.microtasksByHabit, [id]: microtasks },
      logsByHabit: { ...s.logsByHabit, [id]: [] },
    }));

    return id;
  },

  deleteHabit: async (habitId) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (habit) {
      await cancelNotification(habit.reminderNotificationId);
      await cancelNotification(habit.summaryNotificationId);
    }
    await db.runAsync("DELETE FROM habits WHERE id = ?", [habitId]);
    await db.runAsync("DELETE FROM microtasks WHERE habitId = ?", [habitId]);
    await db.runAsync("DELETE FROM daily_logs WHERE habitId = ?", [habitId]);

    set((s) => {
      const { [habitId]: _m, ...restMicrotasks } = s.microtasksByHabit;
      const { [habitId]: _l, ...restLogs } = s.logsByHabit;
      return {
        habits: s.habits.filter((h) => h.id !== habitId),
        microtasksByHabit: restMicrotasks,
        logsByHabit: restLogs,
      };
    });
  },

  incrementAmount: async (habitId, date, delta) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const nextAmount = Math.max(0, (existing?.amount ?? 0) + delta);
    const id = existing?.id ?? genId();

    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
      [id, habitId, date, nextAmount, "[]", null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], amount: nextAmount }
          : { id, habitId, date, amount: nextAmount, microtasksDone: [], reflection: null };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });
  },

  toggleMicrotask: async (habitId, date, microtaskId) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const currentDone = existing?.microtasksDone ?? [];
    const nextDone = currentDone.includes(microtaskId)
      ? currentDone.filter((id) => id !== microtaskId)
      : [...currentDone, microtaskId];
    const id = existing?.id ?? genId();
    const doneJson = JSON.stringify(nextDone);

    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET microtasksDone = excluded.microtasksDone`,
      [id, habitId, date, 0, doneJson, null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], microtasksDone: nextDone }
          : { id, habitId, date, amount: 0, microtasksDone: nextDone, reflection: null };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });
  },

  saveReflection: async (habitId, date, text) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const id = existing?.id ?? genId();

    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET reflection = excluded.reflection`,
      [id, habitId, date, 0, "[]", text]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], reflection: text }
          : { id, habitId, date, amount: 0, microtasksDone: [], reflection: text };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });
  },

  setReminder: async (habitId, enabled, time) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;

    await cancelNotification(habit.reminderNotificationId);
    let reminderNotificationId: string | null = null;
    if (enabled && time) {
      reminderNotificationId = await scheduleDailyNotification(
        habit.name,
        "A gentle reminder to check in today.",
        time
      );
    }

    await db.runAsync(
      "UPDATE habits SET reminderEnabled = ?, reminderTime = ?, reminderNotificationId = ? WHERE id = ?",
      [enabled ? 1 : 0, time, reminderNotificationId, habitId]
    );

    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId ? { ...h, reminderEnabled: enabled, reminderTime: time, reminderNotificationId } : h
      ),
    }));
  },
}));

export function selectLogForDate(logs: DailyLog[] | undefined, date: string): DailyLog | undefined {
  return logs?.find((l) => l.date === date);
}

export function selectTodayLog(logs: DailyLog[] | undefined): DailyLog | undefined {
  return selectLogForDate(logs, todayISO());
}

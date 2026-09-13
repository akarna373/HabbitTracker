import { create } from "zustand";
import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { getCurrentLocation } from "./location";
import { cancelNotification, computeNextOccurrence, scheduleDailyNotification, scheduleOneTimeNotification } from "./notifications";
import { reduceCycleDay, reduceDailyTarget, REDUCE_CYCLE_DAYS } from "./progress";
import { getSwipeSettings, saveSwipeSettings, type SwipeSettings } from "./swipeSettings";
import type { DailyLog, Habit, Microtask, NewHabitDraft, SmokeLocation } from "./types";

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
  locationTrackingEnabled: number;
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
    locationTrackingEnabled: !!row.locationTrackingEnabled,
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
  archivedHabits: Habit[];
  microtasksByHabit: Record<string, Microtask[]>;
  logsByHabit: Record<string, DailyLog[]>;
  smokeLocationsByHabit: Record<string, SmokeLocation[]>;
  swipeSettings: SwipeSettings;
  setSwipeSettings: (settings: Partial<SwipeSettings>) => Promise<void>;
  init: () => Promise<void>;
  createHabit: (draft: NewHabitDraft) => Promise<string>;
  deleteHabit: (habitId: string) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  restoreHabit: (habitId: string) => Promise<void>;
  incrementAmount: (habitId: string, date: string, delta: number) => Promise<void>;
  toggleMicrotask: (habitId: string, date: string, microtaskId: string) => Promise<void>;
  deleteMicrotask: (habitId: string, microtaskId: string) => Promise<void>;
  saveReflection: (habitId: string, date: string, text: string) => Promise<void>;
  setReminder: (habitId: string, enabled: boolean, time: string | null) => Promise<void>;
  setLocationTracking: (habitId: string, enabled: boolean) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  habits: [],
  archivedHabits: [],
  microtasksByHabit: {},
  logsByHabit: {},
  smokeLocationsByHabit: {},
  swipeSettings: { deleteEnabled: true, archiveEnabled: true },

  setSwipeSettings: async (partial) => {
    const next = { ...get().swipeSettings, ...partial };
    await saveSwipeSettings(next);
    set({ swipeSettings: next });
  },

  init: async () => {
    const db = await getDb();
    const swipeSettings = await getSwipeSettings();
    const habitRows = await db.getAllAsync<HabitRow>(
      "SELECT * FROM habits WHERE archivedAt IS NULL ORDER BY createdAt ASC"
    );
    const habits = habitRows.map(rowToHabit);

    const archivedRows = await db.getAllAsync<HabitRow>(
      "SELECT * FROM habits WHERE archivedAt IS NOT NULL ORDER BY archivedAt DESC"
    );
    const archivedHabits = archivedRows.map(rowToHabit);

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

    const smokeLocationRows = await db.getAllAsync<SmokeLocation>("SELECT * FROM smoke_locations");
    const smokeLocationsByHabit: Record<string, SmokeLocation[]> = {};
    for (const row of smokeLocationRows) {
      (smokeLocationsByHabit[row.habitId] ??= []).push(row);
    }

    // A "reduce" habit's nightly notification carries a declining target
    // that changes day to day - a DAILY trigger can't update its own text,
    // so re-derive and reschedule tonight's one-time notification on every
    // app open instead (see lib/notifications.ts:scheduleOneTimeNotification).
    const today = todayISO();
    for (let i = 0; i < habits.length; i++) {
      const habit = habits[i];
      if (habit.goalType !== "reduce" || !habit.hasCost || !habit.summaryTime) continue;
      await cancelNotification(habit.summaryNotificationId);
      const day = reduceCycleDay(habit);
      const target = reduceDailyTarget(habit);
      const todayAmount = logsByHabit[habit.id]?.find((l) => l.date === today)?.amount ?? 0;
      const title = day <= REDUCE_CYCLE_DAYS ? `Day ${day} of ${REDUCE_CYCLE_DAYS}` : "Reduction complete";
      const body =
        day <= REDUCE_CYCLE_DAYS
          ? `Today's target: ${target} ${habit.unit ?? ""}. You've logged ${todayAmount} so far.`
          : `You've reached your zero target. You've logged ${todayAmount} today.`;
      const summaryNotificationId = await scheduleOneTimeNotification(title, body, computeNextOccurrence(habit.summaryTime));
      await db.runAsync("UPDATE habits SET summaryNotificationId = ? WHERE id = ?", [summaryNotificationId, habit.id]);
      habits[i] = { ...habit, summaryNotificationId };
    }

    set({ ready: true, habits, archivedHabits, microtasksByHabit, logsByHabit, smokeLocationsByHabit, swipeSettings });
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
      if (draft.goalType === "reduce") {
        // Day 1 of the reduce cycle always starts at the full baseline
        // (day(14-1)/13 = baseline) - a one-time notification, since a
        // DAILY trigger can't carry a target that changes as the cycle
        // progresses (see reduceCycleDay/reduceDailyTarget in lib/progress.ts).
        summaryNotificationId = await scheduleOneTimeNotification(
          `Day 1 of ${REDUCE_CYCLE_DAYS}`,
          `Today's target: ${draft.baselineQuantity ?? 0} ${draft.unit ?? ""}. You've logged 0 so far.`,
          computeNextOccurrence(draft.summaryTime)
        );
      } else {
        summaryNotificationId = await scheduleDailyNotification(
          "Your 10 PM summary",
          `See how today compared for ${draft.name}.`,
          draft.summaryTime
        );
      }
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
      locationTrackingEnabled: false,
      createdAt: now,
      archivedAt: null,
    };

    set((s) => ({
      habits: [...s.habits, habit],
      microtasksByHabit: { ...s.microtasksByHabit, [id]: microtasks },
      logsByHabit: { ...s.logsByHabit, [id]: [] },
      smokeLocationsByHabit: { ...s.smokeLocationsByHabit, [id]: [] },
    }));

    return id;
  },

  deleteHabit: async (habitId) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId) ?? get().archivedHabits.find((h) => h.id === habitId);
    if (habit) {
      await cancelNotification(habit.reminderNotificationId);
      await cancelNotification(habit.summaryNotificationId);
    }
    await db.runAsync("DELETE FROM habits WHERE id = ?", [habitId]);
    await db.runAsync("DELETE FROM microtasks WHERE habitId = ?", [habitId]);
    await db.runAsync("DELETE FROM daily_logs WHERE habitId = ?", [habitId]);
    await db.runAsync("DELETE FROM smoke_locations WHERE habitId = ?", [habitId]);

    set((s) => {
      const { [habitId]: _m, ...restMicrotasks } = s.microtasksByHabit;
      const { [habitId]: _l, ...restLogs } = s.logsByHabit;
      const { [habitId]: _s, ...restSmokeLocations } = s.smokeLocationsByHabit;
      return {
        habits: s.habits.filter((h) => h.id !== habitId),
        archivedHabits: s.archivedHabits.filter((h) => h.id !== habitId),
        microtasksByHabit: restMicrotasks,
        logsByHabit: restLogs,
        smokeLocationsByHabit: restSmokeLocations,
      };
    });
  },

  archiveHabit: async (habitId) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (habit) {
      await cancelNotification(habit.reminderNotificationId);
      await cancelNotification(habit.summaryNotificationId);
    }
    const now = new Date().toISOString();
    await db.runAsync("UPDATE habits SET archivedAt = ? WHERE id = ?", [now, habitId]);

    // Microtasks and daily_logs rows stay in the database untouched - archiving
    // only hides the habit from active lists, it never deletes its history.
    set((s) => {
      if (!habit) return { habits: s.habits.filter((h) => h.id !== habitId) };
      return {
        habits: s.habits.filter((h) => h.id !== habitId),
        archivedHabits: [{ ...habit, archivedAt: now }, ...s.archivedHabits],
      };
    });
  },

  restoreHabit: async (habitId) => {
    const db = await getDb();
    const habit = get().archivedHabits.find((h) => h.id === habitId);
    await db.runAsync("UPDATE habits SET archivedAt = NULL WHERE id = ?", [habitId]);

    set((s) => {
      if (!habit) return { archivedHabits: s.archivedHabits.filter((h) => h.id !== habitId) };
      return {
        archivedHabits: s.archivedHabits.filter((h) => h.id !== habitId),
        habits: [...s.habits, { ...habit, archivedAt: null }],
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

    // Logging a cigarette (never undoing one) on a location-tracked habit
    // silently records where the user is - runs in the background so it
    // never slows down the tap itself.
    const habit = get().habits.find((h) => h.id === habitId);
    if (delta > 0 && habit?.locationTrackingEnabled) {
      void (async () => {
        const point = await getCurrentLocation();
        if (!point) return;
        const locationId = genId();
        const loggedAt = new Date().toISOString();
        const location: SmokeLocation = { id: locationId, habitId, latitude: point.latitude, longitude: point.longitude, loggedAt };
        await db.runAsync(
          "INSERT INTO smoke_locations (id, habitId, latitude, longitude, loggedAt) VALUES (?,?,?,?,?)",
          [location.id, location.habitId, location.latitude, location.longitude, location.loggedAt]
        );
        set((s) => ({
          smokeLocationsByHabit: {
            ...s.smokeLocationsByHabit,
            [habitId]: [...(s.smokeLocationsByHabit[habitId] ?? []), location],
          },
        }));
      })();
    }
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

  deleteMicrotask: async (habitId, microtaskId) => {
    const db = await getDb();
    await db.runAsync("DELETE FROM microtasks WHERE id = ?", [microtaskId]);

    set((s) => ({
      microtasksByHabit: {
        ...s.microtasksByHabit,
        [habitId]: (s.microtasksByHabit[habitId] ?? []).filter((m) => m.id !== microtaskId),
      },
    }));
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

  setLocationTracking: async (habitId, enabled) => {
    const db = await getDb();
    await db.runAsync("UPDATE habits SET locationTrackingEnabled = ? WHERE id = ?", [enabled ? 1 : 0, habitId]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, locationTrackingEnabled: enabled } : h)),
    }));
  },
}));

export { selectLogForDate, selectTodayLog } from "./progress";

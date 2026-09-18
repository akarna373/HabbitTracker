import { create } from "zustand";
import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { getCurrentLocation } from "./location";
import { syncGeofences } from "./geofencing";
import {
  adjustStock,
  cancelNotification,
  computeNextOccurrence,
  scheduleDailyNotification,
  scheduleIntervalReminder,
  scheduleMorningWalkReminder,
  scheduleOneTimeNotification,
} from "./notifications";
import {
  buildCheckupNotification,
  buildDailySummaryNotification,
  buildReduceSummaryNotification,
  buildReminderNotification,
} from "./notificationContent";
import { cancelMedicationNotifications, scheduleMedicationNotifications } from "./medicationSchedule";
import { parseDosageFrequency } from "./medicationParse";
import { reduceCycleDay, reduceDailyTarget, REDUCE_CYCLE_DAYS } from "./progress";
import { getSwipeSettings, saveSwipeSettings, type SwipeSettings } from "./swipeSettings";
import { getCalendarType, saveCalendarType, type CalendarType } from "./calendarSettings";
import type { DailyLog, GoalType, Habit, Microtask, NewHabitDraft, SmokeLocation } from "./types";

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
  reduceDays: number | null;
  summaryTime: string | null;
  summaryNotificationId: string | null;
  locationTrackingEnabled: number;
  backgroundLocationEnabled: number;
  attendedCount: number | null;
  heldCount: number | null;
  attendanceTarget: number | null;
  examDate: string | null;
  checkupIntervalDays: number | null;
  doseAmount: number | null;
  doseUnit: string | null;
  dosageFrequency: string | null;
  durationType: string | null;
  medicineCategory: string | null;
  medicationNotificationIds: string | null;
  tabletsPerPacket: number | null;
  stockRemaining: number | null;
  lowStockNotifiedAt: string | null;
  medicationStartDate: string | null;
  totalTabletsBought: number | null;
  pillColor: string | null;
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
    backgroundLocationEnabled: !!row.backgroundLocationEnabled,
    medicationNotificationIds: row.medicationNotificationIds ? JSON.parse(row.medicationNotificationIds) : null,
  };
}

interface LogRow {
  id: string;
  habitId: string;
  date: string;
  amount: number;
  amountB: number | null;
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
  calendarType: CalendarType;
  setCalendarType: (type: CalendarType) => Promise<void>;
  init: () => Promise<void>;
  createHabit: (draft: NewHabitDraft) => Promise<string>;
  deleteHabit: (habitId: string) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  restoreHabit: (habitId: string) => Promise<void>;
  incrementAmount: (habitId: string, date: string, delta: number) => Promise<void>;
  refreshHabit: (habitId: string) => Promise<void>;
  confirmRestock: (habitId: string, quantity: number) => Promise<void>;
  setExactStock: (habitId: string, exactAmount: number) => Promise<void>;
  setPillColor: (habitId: string, color: string) => Promise<void>;
  updateMedicationSchedule: (habitId: string, changes: { dosageFrequency?: string; medicationStartDate?: string }) => Promise<void>;
  setGoalType: (habitId: string, goalType: GoalType, reduceDays: number | null) => Promise<void>;
  toggleMicrotask: (habitId: string, date: string, microtaskId: string) => Promise<void>;
  deleteMicrotask: (habitId: string, microtaskId: string) => Promise<void>;
  saveReflection: (habitId: string, date: string, text: string) => Promise<void>;
  setReminder: (habitId: string, enabled: boolean, time: string | null) => Promise<void>;
  setLocationTracking: (habitId: string, enabled: boolean) => Promise<void>;
  setBackgroundLocationTracking: (habitId: string, enabled: boolean) => Promise<void>;
  deleteSmokeLocations: (habitId: string, ids: string[]) => Promise<void>;
  logDualMetric: (habitId: string, date: string, amountA: number, amountB: number) => Promise<void>;
  logAttendance: (habitId: string, attended: boolean) => Promise<void>;
  addMicrotasks: (habitId: string, texts: string[]) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  habits: [],
  archivedHabits: [],
  microtasksByHabit: {},
  logsByHabit: {},
  smokeLocationsByHabit: {},
  swipeSettings: { deleteEnabled: true, archiveEnabled: true },
  calendarType: "gregorian",

  setSwipeSettings: async (partial) => {
    const next = { ...get().swipeSettings, ...partial };
    await saveSwipeSettings(next);
    set({ swipeSettings: next });
  },

  setCalendarType: async (type) => {
    await saveCalendarType(type);
    set({ calendarType: type });
  },

  init: async () => {
    const db = await getDb();
    const swipeSettings = await getSwipeSettings();
    const calendarType = await getCalendarType();
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
      const todayAmount = logsByHabit[habit.id]?.find((l) => l.date === today)?.amount ?? 0;
      const { title, body } = buildReduceSummaryNotification({
        day: reduceCycleDay(habit),
        cycleDays: habit.reduceDays ?? REDUCE_CYCLE_DAYS,
        target: reduceDailyTarget(habit),
        todayAmount,
        unit: habit.unit,
      }).content;
      const summaryNotificationId = await scheduleOneTimeNotification(title, body, computeNextOccurrence(habit.summaryTime));
      await db.runAsync("UPDATE habits SET summaryNotificationId = ? WHERE id = ?", [summaryNotificationId, habit.id]);
      habits[i] = { ...habit, summaryNotificationId };
    }

    set({ ready: true, habits, archivedHabits, microtasksByHabit, logsByHabit, smokeLocationsByHabit, swipeSettings, calendarType });

    // Android clears registered geofences on reboot, so re-register on every
    // app open - same defensive pattern as the notification reschedule above.
    syncGeofences(habits, smokeLocationsByHabit);
  },

  createHabit: async (draft) => {
    const db = await getDb();
    const id = genId();
    const now = new Date().toISOString();

    // Medication's setup screen never asks for a daily target (its own
    // amount/count section is hidden) - without this, targetAmount stays
    // null and isHabitCompleteOn compares against Infinity, so the habit
    // could never show a completed day or a streak.
    const targetAmount = draft.templateId === "medication" ? parseDosageFrequency(draft.dosageFrequency) : draft.targetAmount;

    let reminderNotificationId: string | null = null;
    let medicationNotificationIds: string[] | null = null;
    if (draft.templateId === "medication") {
      medicationNotificationIds = await scheduleMedicationNotifications({
        habitId: id,
        name: draft.name,
        doseAmount: draft.doseAmount,
        doseUnit: draft.doseUnit,
        dosageFrequency: draft.dosageFrequency,
        durationType: draft.durationType,
        startTime: draft.reminderTime ?? "08:00",
        startDate: draft.startDate ?? todayISO(),
      });
    } else if (draft.templateId === "doctor_checkup" && draft.checkupIntervalDays) {
      const { title, body } = buildCheckupNotification(draft.name).content;
      reminderNotificationId = await scheduleIntervalReminder(title, body, draft.checkupIntervalDays * 24 * 60 * 60);
    } else if (draft.reminderEnabled && draft.reminderTime) {
      if (draft.templateId === "walking_jogging") {
        reminderNotificationId = await scheduleMorningWalkReminder(id, draft.reminderTime);
      } else {
        const { title, body } = buildReminderNotification(draft.name).content;
        reminderNotificationId = await scheduleDailyNotification(title, body, draft.reminderTime);
      }
    }

    let summaryNotificationId: string | null = null;
    if (draft.hasCost && draft.summaryTime) {
      if (draft.goalType === "reduce") {
        // Day 1 of the reduce cycle always starts at the full baseline
        // (day(N-1)/(N-1) = baseline) - a one-time notification, since a
        // DAILY trigger can't carry a target that changes as the cycle
        // progresses (see reduceCycleDay/reduceDailyTarget in lib/progress.ts).
        const { title, body } = buildReduceSummaryNotification({
          day: 1,
          cycleDays: draft.reduceDays ?? REDUCE_CYCLE_DAYS,
          target: draft.baselineQuantity ?? 0,
          todayAmount: 0,
          unit: draft.unit,
        }).content;
        summaryNotificationId = await scheduleOneTimeNotification(title, body, computeNextOccurrence(draft.summaryTime));
      } else {
        const { title, body } = buildDailySummaryNotification(draft.name).content;
        summaryNotificationId = await scheduleDailyNotification(title, body, draft.summaryTime);
      }
    }

    await db.runAsync(
      `INSERT INTO habits (
        id, kind, category, templateId, name, trackingMethod, targetAmount, unit, reason,
        frequencyType, repeatDays, reminderEnabled, reminderTime, reminderNotificationId,
        hasCost, baselineQuantity, pricePerItem, goalType, reduceDays, summaryTime, summaryNotificationId,
        attendedCount, heldCount, attendanceTarget, examDate, checkupIntervalDays,
        doseAmount, doseUnit, dosageFrequency, durationType, medicineCategory, medicationNotificationIds,
        tabletsPerPacket, stockRemaining, lowStockNotifiedAt, medicationStartDate, totalTabletsBought,
        createdAt, archivedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      [
        id,
        draft.kind,
        draft.category,
        draft.templateId,
        draft.name,
        draft.trackingMethod,
        targetAmount,
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
        draft.reduceDays,
        draft.summaryTime,
        summaryNotificationId,
        draft.templateId === "attendance" ? 0 : null,
        draft.templateId === "attendance" ? 0 : null,
        draft.attendanceTarget,
        draft.examDate,
        draft.checkupIntervalDays,
        draft.doseAmount,
        draft.doseUnit,
        draft.dosageFrequency,
        draft.durationType,
        draft.medicineCategory,
        medicationNotificationIds ? JSON.stringify(medicationNotificationIds) : null,
        draft.tabletsPerPacket,
        draft.tabletsPerPacket,
        null,
        draft.startDate,
        draft.tabletsPerPacket,
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
      targetAmount,
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
      reduceDays: draft.reduceDays,
      summaryTime: draft.summaryTime,
      summaryNotificationId,
      locationTrackingEnabled: false,
      backgroundLocationEnabled: false,
      attendedCount: draft.templateId === "attendance" ? 0 : null,
      heldCount: draft.templateId === "attendance" ? 0 : null,
      attendanceTarget: draft.attendanceTarget,
      examDate: draft.examDate,
      checkupIntervalDays: draft.checkupIntervalDays,
      doseAmount: draft.doseAmount,
      doseUnit: draft.doseUnit,
      dosageFrequency: draft.dosageFrequency,
      durationType: draft.durationType,
      medicineCategory: draft.medicineCategory,
      medicationNotificationIds,
      tabletsPerPacket: draft.tabletsPerPacket,
      stockRemaining: draft.tabletsPerPacket,
      lowStockNotifiedAt: null,
      medicationStartDate: draft.startDate,
      totalTabletsBought: draft.tabletsPerPacket,
      pillColor: null,
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
      await cancelMedicationNotifications(habit.medicationNotificationIds);
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
      await cancelMedicationNotifications(habit.medicationNotificationIds);
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

  // Re-reads one habit's row and logs from the DB - for writes that bypass
  // the store (notification actions run without a mounted React tree, see
  // lib/notifications.ts).
  refreshHabit: async (habitId) => {
    const db = await getDb();
    const habitRow = await db.getFirstAsync<HabitRow>("SELECT * FROM habits WHERE id = ?", [habitId]);
    const logRows = await db.getAllAsync<LogRow>("SELECT * FROM daily_logs WHERE habitId = ?", [habitId]);
    set((s) => ({
      habits: habitRow && !habitRow.archivedAt ? s.habits.map((h) => (h.id === habitId ? rowToHabit(habitRow) : h)) : s.habits,
      logsByHabit: { ...s.logsByHabit, [habitId]: logRows.map(rowToLog) },
    }));
  },

  incrementAmount: async (habitId, date, delta) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const nextAmount = Math.max(0, (existing?.amount ?? 0) + delta);
    const id = existing?.id ?? genId();

    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
      [id, habitId, date, nextAmount, existing?.amountB ?? null, "[]", null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], amount: nextAmount }
          : { id, habitId, date, amount: nextAmount, amountB: null, microtasksDone: [], reflection: null };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });

    // Logging a cigarette (never undoing one) on a location-tracked habit
    // silently records where the user is - runs in the background so it
    // never slows down the tap itself.
    const habit = get().habits.find((h) => h.id === habitId);

    if (habit?.templateId === "medication" && habit.stockRemaining !== null) {
      const nextStock = await adjustStock(habitId, delta);
      set((s) => ({
        habits: s.habits.map((h) => (h.id === habitId ? { ...h, stockRemaining: nextStock } : h)),
      }));
    }

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
        const nextSmokeLocationsByHabit = {
          ...get().smokeLocationsByHabit,
          [habitId]: [...(get().smokeLocationsByHabit[habitId] ?? []), location],
        };
        set({ smokeLocationsByHabit: nextSmokeLocationsByHabit });
        // This new point may have just completed a 3-point hotspot cluster -
        // re-sync so a background geofence gets registered for it right away.
        syncGeofences(get().habits, nextSmokeLocationsByHabit);
      })();
    }
  },

  // "I bought more" - the user says how many they actually bought, added
  // to both stockRemaining (what's left) and totalTabletsBought (the real
  // denominator for the progress bar - not the original packet size,
  // which would otherwise cap the bar at 100% forever after one restock);
  // also clears lowStockNotifiedAt so a future low point can alert again.
  confirmRestock: async (habitId, quantity) => {
    if (!quantity || quantity <= 0) return;
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit || !habit.tabletsPerPacket) return;
    // Falls back to tabletsPerPacket, not 0 - a habit whose
    // totalTabletsBought predates this column (created before it existed)
    // would otherwise undercount every restock from here on.
    const baseTotal = habit.totalTabletsBought ?? habit.tabletsPerPacket;
    const nextStock = (habit.stockRemaining ?? 0) + quantity;
    const nextTotal = baseTotal + quantity;
    await db.runAsync(
      "UPDATE habits SET stockRemaining = ?, totalTabletsBought = ?, lowStockNotifiedAt = NULL WHERE id = ?",
      [nextStock, nextTotal, habitId]
    );
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId ? { ...h, stockRemaining: nextStock, totalTabletsBought: nextTotal, lowStockNotifiedAt: null } : h
      ),
    }));
  },

  // A full reset, not a purchase - "I have exactly N right now" wipes any
  // drifted history and restarts both the remaining count and the progress
  // bar's own total from that same number (not a floor on top of whatever
  // total was on record before - that reads as "still 31 total" even after
  // the user explicitly said "21," which is the confusing part a plain
  // max() got wrong).
  setExactStock: async (habitId, exactAmount) => {
    if (exactAmount < 0) return;
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit || !habit.tabletsPerPacket) return;
    await db.runAsync(
      "UPDATE habits SET stockRemaining = ?, totalTabletsBought = ?, lowStockNotifiedAt = NULL WHERE id = ?",
      [exactAmount, exactAmount, habitId]
    );
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId ? { ...h, stockRemaining: exactAmount, totalTabletsBought: exactAmount, lowStockNotifiedAt: null } : h
      ),
    }));
  },

  setPillColor: async (habitId, color) => {
    const db = await getDb();
    await db.runAsync("UPDATE habits SET pillColor = ? WHERE id = ?", [color, habitId]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, pillColor: color } : h)),
    }));
  },

  // Real prescriptions change mid-course - this only touches the schedule
  // going forward (frequency, start date, the derived dose target, and the
  // scheduled reminders); stock, price and logged history are left exactly
  // as they are, on purpose.
  updateMedicationSchedule: async (habitId, changes) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;

    await cancelMedicationNotifications(habit.medicationNotificationIds);
    const dosageFrequency = changes.dosageFrequency ?? habit.dosageFrequency;
    const medicationStartDate = changes.medicationStartDate ?? habit.medicationStartDate;
    const medicationNotificationIds = await scheduleMedicationNotifications({
      habitId: habit.id,
      name: habit.name,
      doseAmount: habit.doseAmount,
      doseUnit: habit.doseUnit,
      dosageFrequency,
      durationType: habit.durationType,
      startTime: habit.reminderTime ?? "08:00",
      startDate: medicationStartDate ?? todayISO(),
    });
    const targetAmount = changes.dosageFrequency ? parseDosageFrequency(dosageFrequency) : habit.targetAmount;

    await db.runAsync(
      "UPDATE habits SET dosageFrequency = ?, medicationStartDate = ?, medicationNotificationIds = ?, targetAmount = ? WHERE id = ?",
      [dosageFrequency, medicationStartDate, JSON.stringify(medicationNotificationIds), targetAmount, habitId]
    );
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId ? { ...h, dosageFrequency, medicationStartDate, medicationNotificationIds, targetAmount } : h
      ),
    }));
  },

  setGoalType: async (habitId, goalType, reduceDays) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;
    const updatedHabit: Habit = { ...habit, goalType, reduceDays };

    await cancelNotification(habit.summaryNotificationId);
    let summaryNotificationId: string | null = null;
    if (updatedHabit.hasCost && updatedHabit.summaryTime) {
      if (goalType === "reduce") {
        const today = todayISO();
        const todayAmount = get().logsByHabit[habitId]?.find((l) => l.date === today)?.amount ?? 0;
        const { title, body } = buildReduceSummaryNotification({
          day: reduceCycleDay(updatedHabit),
          cycleDays: reduceDays ?? REDUCE_CYCLE_DAYS,
          target: reduceDailyTarget(updatedHabit),
          todayAmount,
          unit: updatedHabit.unit,
        }).content;
        summaryNotificationId = await scheduleOneTimeNotification(title, body, computeNextOccurrence(updatedHabit.summaryTime));
      } else {
        const { title, body } = buildDailySummaryNotification(updatedHabit.name).content;
        summaryNotificationId = await scheduleDailyNotification(title, body, updatedHabit.summaryTime);
      }
    }

    await db.runAsync("UPDATE habits SET goalType = ?, reduceDays = ?, summaryNotificationId = ? WHERE id = ?", [
      goalType,
      reduceDays,
      summaryNotificationId,
      habitId,
    ]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, goalType, reduceDays, summaryNotificationId } : h)),
    }));
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
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET microtasksDone = excluded.microtasksDone`,
      [id, habitId, date, 0, existing?.amountB ?? null, doneJson, null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], microtasksDone: nextDone }
          : { id, habitId, date, amount: 0, amountB: null, microtasksDone: nextDone, reflection: null };
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
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET reflection = excluded.reflection`,
      [id, habitId, date, 0, existing?.amountB ?? null, "[]", text]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], reflection: text }
          : { id, habitId, date, amount: 0, amountB: null, microtasksDone: [], reflection: text };
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
      const { title, body } = buildReminderNotification(habit.name).content;
      reminderNotificationId = await scheduleDailyNotification(title, body, time);
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
    // Background detection can't exist without foreground capture - turning
    // foreground off takes background with it.
    const backgroundLocationEnabled = enabled ? get().habits.find((h) => h.id === habitId)?.backgroundLocationEnabled ?? false : false;
    await db.runAsync("UPDATE habits SET locationTrackingEnabled = ?, backgroundLocationEnabled = ? WHERE id = ?", [
      enabled ? 1 : 0,
      backgroundLocationEnabled ? 1 : 0,
      habitId,
    ]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, locationTrackingEnabled: enabled, backgroundLocationEnabled } : h)),
    }));
    syncGeofences(get().habits, get().smokeLocationsByHabit);
  },

  setBackgroundLocationTracking: async (habitId, enabled) => {
    const db = await getDb();
    await db.runAsync("UPDATE habits SET backgroundLocationEnabled = ? WHERE id = ?", [enabled ? 1 : 0, habitId]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, backgroundLocationEnabled: enabled } : h)),
    }));
    syncGeofences(get().habits, get().smokeLocationsByHabit);
  },

  deleteSmokeLocations: async (habitId, ids) => {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(`DELETE FROM smoke_locations WHERE id IN (${placeholders})`, ids);

    const idSet = new Set(ids);
    const nextSmokeLocationsByHabit = {
      ...get().smokeLocationsByHabit,
      [habitId]: (get().smokeLocationsByHabit[habitId] ?? []).filter((l) => !idSet.has(l.id)),
    };
    set({ smokeLocationsByHabit: nextSmokeLocationsByHabit });
    // Deleting a cluster's points removes it from the next geofence sync too -
    // this is what actually stops a mis-logged spot (e.g. home) from firing.
    syncGeofences(get().habits, nextSmokeLocationsByHabit);
  },

  logDualMetric: async (habitId, date, amountA, amountB) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const id = existing?.id ?? genId();

    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount, amountB = excluded.amountB`,
      [id, habitId, date, amountA, amountB, existing ? JSON.stringify(existing.microtasksDone) : "[]", existing?.reflection ?? null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], amount: amountA, amountB }
          : { id, habitId, date, amount: amountA, amountB, microtasksDone: [], reflection: null };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });
  },

  logAttendance: async (habitId, attended) => {
    const db = await getDb();
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;
    const nextAttended = (habit.attendedCount ?? 0) + (attended ? 1 : 0);
    const nextHeld = (habit.heldCount ?? 0) + 1;

    await db.runAsync("UPDATE habits SET attendedCount = ?, heldCount = ? WHERE id = ?", [nextAttended, nextHeld, habitId]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, attendedCount: nextAttended, heldCount: nextHeld } : h)),
    }));

    // A plain check-in for today too, purely so this habit still shows up in
    // streaks/home completion the same way every other habit does - the real
    // attendance numbers live on the habit row above, not in this log.
    const today = todayISO();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === today);
    const logId = existing?.id ?? genId();
    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
      [logId, habitId, today, 1, existing?.amountB ?? null, existing ? JSON.stringify(existing.microtasksDone) : "[]", existing?.reflection ?? null]
    );
    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === today);
      const updated: DailyLog =
        idx >= 0 ? { ...logs[idx], amount: 1 } : { id: logId, habitId, date: today, amount: 1, amountB: null, microtasksDone: [], reflection: null };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });
  },

  addMicrotasks: async (habitId, texts) => {
    const trimmed = texts.map((t) => t.trim()).filter(Boolean);
    if (trimmed.length === 0) return;
    const db = await getDb();
    const existing = get().microtasksByHabit[habitId] ?? [];
    let nextSort = existing.length;
    const added: Microtask[] = [];
    for (const text of trimmed) {
      const microtaskId = genId();
      await db.runAsync("INSERT INTO microtasks (id, habitId, text, sortOrder) VALUES (?,?,?,?)", [
        microtaskId,
        habitId,
        text,
        nextSort++,
      ]);
      added.push({ id: microtaskId, habitId, text, sortOrder: nextSort - 1 });
    }
    set((s) => ({
      microtasksByHabit: { ...s.microtasksByHabit, [habitId]: [...(s.microtasksByHabit[habitId] ?? []), ...added] },
    }));
  },
}));

export { selectLogForDate, selectTodayLog } from "./progress";

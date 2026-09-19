import { create } from "zustand";
import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { getCurrentLocation } from "./location";
import { setActiveCurrencyCode } from "./currency";
import { chooseBackground, pickBackground, SUMMARY_BACKGROUND_COUNT, type BackgroundSelection } from "./backgroundRotation";
import { loadSummaryBackground, saveSummaryBackground } from "./summaryBackgroundStorage";
import {
  DEFAULT_FINANCIAL_SETTINGS,
  isValidMonthlyGoal,
  normalizeCurrencyCode,
  sanitizeFinancialSettings,
} from "./financialSettings";
import { syncGeofences } from "./geofencing";
import {
  adjustStock,
  cancelNotification,
  scheduleDailyNotification,
  scheduleIntervalReminder,
  scheduleMorningWalkReminder,
} from "./notifications";
import { buildCheckupNotification, buildReminderNotification } from "./notificationContent";
import { cancelMedicationNotifications, scheduleMedicationNotifications } from "./medicationSchedule";
import { parseDosageFrequency } from "./medicationParse";
import { getSwipeSettings, saveSwipeSettings, type SwipeSettings } from "./swipeSettings";
import { getCalendarType, saveCalendarType, type CalendarType } from "./calendarSettings";
import { upsertLoggedAmount } from "./logWrites";
import {
  deleteSavingsDataForHabit,
  ensureTermsHistory,
  loadLedgerRows,
  loadTermsHistory,
  syncSavingsLedger,
  updateHabitTerms as updateHabitTermsInDb,
  type TermsChangeScope,
} from "./savingsLedgerDb";
import type { LedgerRow } from "./savingsLedger";
import type { DailyLog, FinancialSettings, GoalType, Habit, Microtask, NewHabitDraft, SmokeLocation, TermsEntry } from "./types";

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

// `history` is the habit's baseline/price history (lib/termsHistory.ts); without it the habit just
// uses the values on its row.
function rowToHabit(row: HabitRow, history?: TermsEntry[]): Habit {
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
    ...(history && history.length > 0 ? { termsHistory: history } : {}),
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
  amountLogged: number;
}

function rowToLog(row: LogRow): DailyLog {
  return { ...row, microtasksDone: JSON.parse(row.microtasksDone), amountLogged: row.amountLogged !== 0 };
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
  // Which Summary background is showing and the local date it was chosen (see
  // lib/backgroundRotation.ts). Chosen in init() / refreshSummaryBackground(),
  // never while rendering, and untouched by any other store update.
  summaryBackground: BackgroundSelection;
  refreshSummaryBackground: () => void;
  chooseSummaryBackground: (index: number) => void;
  financialSettings: FinancialSettings;
  updateFinancialSettings: (changes: Partial<FinancialSettings>) => Promise<void>;
  // The daily savings ledger (lib/savingsLedger.ts), mirrored from the database.
  savingsLedger: LedgerRow[];
  // Brings the ledger in line with the logs, finalizes every day that has ended, and
  // reloads it. Safe to call as often as needed.
  syncSavings: () => Promise<void>;
  // Re-reads habits and logs from the database (a notification action may have written
  // while the app was in the background), then syncs the ledger.
  resume: () => Promise<void>;
  // Changes a cost-tracked quit habit's baseline and price (also how a habit that never had a
  // baseline gets one). The scope says whether finished days keep their old values or are
  // recalculated. Returns whether anything was saved.
  updateHabitTerms: (
    habitId: string,
    terms: { baselineQuantity: number; pricePerItem: number },
    scope: TermsChangeScope
  ) => Promise<boolean>;
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
  financialSettings: DEFAULT_FINANCIAL_SETTINGS,
  savingsLedger: [],
  summaryBackground: { index: 0, date: "" },

  // The easter-egg chooser: picks a background by hand. It starts a fresh
  // three-day period today, after which the automatic rotation carries on.
  chooseSummaryBackground: (index) => {
    const selection = chooseBackground(index, todayISO(), SUMMARY_BACKGROUND_COUNT);
    if (!selection) return;
    saveSummaryBackground(selection);
    set({ summaryBackground: selection });
  },

  // Called when the Summary card is on screen: at startup, on returning to the
  // app, and once a minute. Does nothing (no state change, no re-render) until a
  // two-day period has actually ended.
  refreshSummaryBackground: () => {
    const { selection, changed } = pickBackground({
      stored: get().summaryBackground,
      today: todayISO(),
      count: SUMMARY_BACKGROUND_COUNT,
      random: Math.random,
    });
    if (!changed) return;
    saveSummaryBackground(selection);
    set({ summaryBackground: selection });
  },

  setSwipeSettings: async (partial) => {
    const next = { ...get().swipeSettings, ...partial };
    await saveSwipeSettings(next);
    set({ swipeSettings: next });
  },

  setCalendarType: async (type) => {
    await saveCalendarType(type);
    set({ calendarType: type });
  },

  // Saves the monthly goal and/or currency. A goal of null removes it; an
  // invalid goal or currency is ignored (the screens validate first, this is the
  // last line of defence so bad input can never reach the database).
  updateFinancialSettings: async (changes) => {
    const current = get().financialSettings;
    const next: FinancialSettings = { ...current };
    if (changes.monthlyGoal !== undefined) {
      if (changes.monthlyGoal !== null && !isValidMonthlyGoal(changes.monthlyGoal)) return;
      next.monthlyGoal = changes.monthlyGoal;
    }
    if (changes.currencyCode !== undefined) {
      const code = normalizeCurrencyCode(changes.currencyCode);
      if (code === null) return;
      next.currencyCode = code;
    }
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO financial_settings (id, monthlyGoal, currencyCode) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET monthlyGoal = excluded.monthlyGoal, currencyCode = excluded.currencyCode",
      [next.monthlyGoal, next.currencyCode]
    );
    setActiveCurrencyCode(next.currencyCode);
    set({ financialSettings: next });
  },

  init: async () => {
    const db = await getDb();
    const swipeSettings = await getSwipeSettings();
    const calendarType = await getCalendarType();
    // Every cost-tracked habit gets its price/baseline history before habits are read. A failure
    // here must not stop the app opening: habits then simply use the values on their row.
    let historyByHabit: Record<string, TermsEntry[]> = {};
    try {
      await ensureTermsHistory(db);
      historyByHabit = await loadTermsHistory(db);
    } catch {
      // continue without a history
    }
    const habitRows = await db.getAllAsync<HabitRow>(
      "SELECT * FROM habits WHERE archivedAt IS NULL ORDER BY createdAt ASC"
    );
    const habits = habitRows.map((row) => rowToHabit(row, historyByHabit[row.id]));

    const archivedRows = await db.getAllAsync<HabitRow>(
      "SELECT * FROM habits WHERE archivedAt IS NOT NULL ORDER BY archivedAt DESC"
    );
    const archivedHabits = archivedRows.map((row) => rowToHabit(row, historyByHabit[row.id]));

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

    const financialSettings = sanitizeFinancialSettings(
      await db.getFirstAsync<{ monthlyGoal: number | null; currencyCode: string }>(
        "SELECT monthlyGoal, currencyCode FROM financial_settings WHERE id = 1"
      )
    );
    setActiveCurrencyCode(financialSettings.currencyCode);

    const summaryBackground = loadSummaryBackground(todayISO());

    const smokeLocationRows = await db.getAllAsync<SmokeLocation>("SELECT * FROM smoke_locations");
    const smokeLocationsByHabit: Record<string, SmokeLocation[]> = {};
    for (const row of smokeLocationRows) {
      (smokeLocationsByHabit[row.habitId] ??= []).push(row);
    }

    // The per-habit nightly summary notification was removed (a single central
    // summary replaces it) - cancel any that an earlier version scheduled.
    for (let i = 0; i < habits.length; i++) {
      const habit = habits[i];
      if (!habit.summaryNotificationId) continue;
      await cancelNotification(habit.summaryNotificationId);
      await db.runAsync("UPDATE habits SET summaryNotificationId = NULL WHERE id = ?", [habit.id]);
      habits[i] = { ...habit, summaryNotificationId: null };
    }

    // Bring the savings ledger up to date before the first render: days that ended
    // while the app was closed are finalized here, and anything a notification action
    // logged in the meantime is picked up. A failure must never stop the app opening;
    // the ledger is derived from the logs, so the next sync repairs it.
    let savingsLedger: LedgerRow[] = [];
    try {
      await syncSavingsLedger(db);
      savingsLedger = await loadLedgerRows(db);
    } catch {
      // leave it empty
    }

    set({
      ready: true,
      habits,
      archivedHabits,
      microtasksByHabit,
      logsByHabit,
      smokeLocationsByHabit,
      swipeSettings,
      calendarType,
      financialSettings,
      savingsLedger,
      summaryBackground,
    });

    // Android clears registered geofences on reboot, so re-register on every
    // app open - same defensive pattern as the notification reschedule above.
    syncGeofences(habits, smokeLocationsByHabit);
  },

  syncSavings: async () => {
    try {
      const db = await getDb();
      const plan = await syncSavingsLedger(db);
      if (plan.upserts.length > 0 || plan.deletes.length > 0) set({ savingsLedger: await loadLedgerRows(db) });
    } catch {
      // Derived from the logs, so the next sync repairs whatever this one missed.
    }
  },

  resume: async () => {
    try {
      const db = await getDb();
      const habitRows = await db.getAllAsync<HabitRow>("SELECT * FROM habits WHERE archivedAt IS NULL ORDER BY createdAt ASC");
      const archivedRows = await db.getAllAsync<HabitRow>("SELECT * FROM habits WHERE archivedAt IS NOT NULL ORDER BY archivedAt DESC");
      const logRows = await db.getAllAsync<LogRow>("SELECT * FROM daily_logs");
      const logsByHabit: Record<string, DailyLog[]> = {};
      for (const row of logRows) (logsByHabit[row.habitId] ??= []).push(rowToLog(row));
      const historyByHabit = await loadTermsHistory(db);
      set({
        habits: habitRows.map((row) => rowToHabit(row, historyByHabit[row.id])),
        archivedHabits: archivedRows.map((row) => rowToHabit(row, historyByHabit[row.id])),
        logsByHabit,
      });
      await syncSavingsLedger(db);
      set({ savingsLedger: await loadLedgerRows(db) });
    } catch {
      // Keep showing what is already loaded.
    }
  },

  updateHabitTerms: async (habitId, terms, scope) => {
    const db = await getDb();
    const changed = await updateHabitTermsInDb(db, habitId, terms, scope);
    if (!changed) return false;
    const history = (await loadTermsHistory(db, habitId))[habitId];
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === habitId
          ? { ...h, baselineQuantity: terms.baselineQuantity, pricePerItem: terms.pricePerItem, termsHistory: history }
          : h
      ),
    }));
    // The ledger was rebuilt in the database; show what is there now.
    set({ savingsLedger: await loadLedgerRows(db) });
    return true;
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
      const { title, body, data } = buildCheckupNotification(id, draft.name).content;
      reminderNotificationId = await scheduleIntervalReminder(title, body, draft.checkupIntervalDays * 24 * 60 * 60, {
        data,
      });
    } else if (draft.reminderEnabled && draft.reminderTime) {
      if (draft.templateId === "walking_jogging") {
        reminderNotificationId = await scheduleMorningWalkReminder(id, draft.reminderTime);
      } else {
        const { title, body, data } = buildReminderNotification(id, draft.name).content;
        reminderNotificationId = await scheduleDailyNotification(title, body, draft.reminderTime, { data });
      }
    }

    // No per-habit summary notification any more (see init).
    const summaryNotificationId: string | null = null;

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
    await deleteSavingsDataForHabit(db, habitId);

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
        savingsLedger: s.savingsLedger.filter((row) => row.habitId !== habitId),
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
    // Days after the archive date stop counting; the days before it stay.
    void get().syncSavings();
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
    void get().syncSavings();
  },

  // Re-reads one habit's row and logs from the DB - for writes that bypass
  // the store (notification actions run without a mounted React tree, see
  // lib/notifications.ts).
  refreshHabit: async (habitId) => {
    const db = await getDb();
    const habitRow = await db.getFirstAsync<HabitRow>("SELECT * FROM habits WHERE id = ?", [habitId]);
    const logRows = await db.getAllAsync<LogRow>("SELECT * FROM daily_logs WHERE habitId = ?", [habitId]);
    const history = (await loadTermsHistory(db, habitId))[habitId];
    set((s) => ({
      habits: habitRow && !habitRow.archivedAt ? s.habits.map((h) => (h.id === habitId ? rowToHabit(habitRow, history) : h)) : s.habits,
      logsByHabit: { ...s.logsByHabit, [habitId]: logRows.map(rowToLog) },
    }));
    // A notification action changed this habit's count: bring the ledger along too.
    await get().syncSavings();
  },

  incrementAmount: async (habitId, date, delta) => {
    const db = await getDb();
    const existing = get().logsByHabit[habitId]?.find((l) => l.date === date);
    const nextAmount = Math.max(0, (existing?.amount ?? 0) + delta);
    const id = existing?.id ?? genId();

    await upsertLoggedAmount(db, { id, habitId, date, amount: nextAmount, amountB: existing?.amountB ?? null });

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], amount: nextAmount, amountLogged: true }
          : { id, habitId, date, amount: nextAmount, amountB: null, microtasksDone: [], reflection: null, amountLogged: true };
      const nextLogs = idx >= 0 ? logs.map((l, i) => (i === idx ? updated : l)) : [...logs, updated];
      return { logsByHabit: { ...s.logsByHabit, [habitId]: nextLogs } };
    });

    // The savings ledger follows every count immediately (see lib/savingsLedger.ts).
    void get().syncSavings();

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
    await db.runAsync("UPDATE habits SET goalType = ?, reduceDays = ? WHERE id = ?", [goalType, reduceDays, habitId]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, goalType, reduceDays } : h)),
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

    // A row created just to hold a ticked microtask is a placeholder (amountLogged 0):
    // its amount of 0 must not read as "logged zero consumption".
    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection, amountLogged)
       VALUES (?,?,?,?,?,?,?,0)
       ON CONFLICT(habitId, date) DO UPDATE SET microtasksDone = excluded.microtasksDone`,
      [id, habitId, date, 0, existing?.amountB ?? null, doneJson, null]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], microtasksDone: nextDone }
          : { id, habitId, date, amount: 0, amountB: null, microtasksDone: nextDone, reflection: null, amountLogged: false };
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

    // Same as a ticked microtask: a row made only to hold a reflection is a placeholder.
    await db.runAsync(
      `INSERT INTO daily_logs (id, habitId, date, amount, amountB, microtasksDone, reflection, amountLogged)
       VALUES (?,?,?,?,?,?,?,0)
       ON CONFLICT(habitId, date) DO UPDATE SET reflection = excluded.reflection`,
      [id, habitId, date, 0, existing?.amountB ?? null, "[]", text]
    );

    set((s) => {
      const logs = s.logsByHabit[habitId] ?? [];
      const idx = logs.findIndex((l) => l.date === date);
      const updated: DailyLog =
        idx >= 0
          ? { ...logs[idx], reflection: text }
          : { id, habitId, date, amount: 0, amountB: null, microtasksDone: [], reflection: text, amountLogged: false };
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
      const { title, body, data } = buildReminderNotification(habitId, habit.name).content;
      reminderNotificationId = await scheduleDailyNotification(title, body, time, { data });
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
          : { id, habitId, date, amount: amountA, amountB, microtasksDone: [], reflection: null, amountLogged: true };
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
        idx >= 0
          ? { ...logs[idx], amount: 1 }
          : { id: logId, habitId, date: today, amount: 1, amountB: null, microtasksDone: [], reflection: null, amountLogged: true };
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

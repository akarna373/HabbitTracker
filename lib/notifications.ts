import Storage from "expo-sqlite/kv-store";
import * as TaskManager from "expo-task-manager";
import type { NotificationResponse, NotificationTaskPayload } from "expo-notifications";
import { getDb } from "./db";
import { genId } from "./id";
import { isoDate, todayISO } from "./dates";
import { reduceCycleDayForDate, reduceDailyTargetForDate, REDUCE_CYCLE_DAYS } from "./progress";
import { parseDosageFrequency } from "./medicationParse";
import {
  buildEncouragementNotification,
  buildHabitTestNotifications,
  buildHotspotNotification,
  buildLowStockNotification,
  buildReduceSummaryNotification,
  buildWalkNotification,
  DETERRENT_CHANNEL_ID,
  DOSE_ACTION_ID,
  DOSE_CATEGORY,
  DOSE_CATEGORY_ID,
  DOSE_DISMISS_ACTION_ID,
  HOTSPOT_DISMISS_ACTION_ID,
  HOTSPOT_NO_ACTION_ID,
  HOTSPOT_YES_ACTION_ID,
  WALK_ACTION_ID,
  WALK_CATEGORY,
  type NotificationCategorySpec,
} from "./notificationContent";
import type { Habit } from "./types";

// Developer-only "Test notification" button gate (see fireTestNotification).
// EXPO_PUBLIC_ vars are inlined at bundle time, so the literal
// process.env.EXPO_PUBLIC_... access below must stay un-destructured.
export function isNotificationTestEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_ENABLE_NOTIFICATION_TEST === "1";
}

// Release builds don't reliably reach logcat, so each line is also kept in a
// small on-device trail (last 60 lines) that survives the app being killed -
// readable from a debuggable build with run-as, or shown in a debug screen.
export const NOTIFICATION_TEST_TRAIL_KEY = "notif-test-trail";

function testLog(...args: unknown[]): void {
  if (!isNotificationTestEnabled()) return;
  console.log("[notif-test]", ...args);
  try {
    const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    const previous = Storage.getItemSync(NOTIFICATION_TEST_TRAIL_KEY);
    const lines = previous ? previous.split("\n") : [];
    lines.push(`${new Date().toISOString()} ${text}`);
    Storage.setItemSync(NOTIFICATION_TEST_TRAIL_KEY, lines.slice(-60).join("\n"));
  } catch {
    // logging must never break the notification path
  }
}

// expo-notifications throws on import inside Expo Go (SDK 53+ removed the module
// there entirely, not just remote push). Load it defensively so the rest of the
// app still works in Expo Go; real scheduling only happens in a dev/prod build.
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require("expo-notifications");
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  Notifications = null;
}

// Android notifications default to a silent "DEFAULT" importance channel -
// no heads-up popup, no sound, easy to miss entirely in the shade. The
// location-deterrent alert only works if the user actually notices it, so
// it gets its own high-importance channel.
async function ensureDeterrentChannel(): Promise<void> {
  if (!Notifications) return;
  // "default" isn't a real sound resource name on Android here (it wants an
  // actual registered file, or nothing) - omitting it lets the channel use
  // the system's own default notification sound.
  await Notifications.setNotificationChannelAsync(DETERRENT_CHANNEL_ID, {
    name: "Location deterrent alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}
ensureDeterrentChannel().catch(() => {});

async function registerCategory(spec: NotificationCategorySpec): Promise<void> {
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync(
    spec.id,
    spec.actions.map((a) => ({
      identifier: a.identifier,
      buttonTitle: a.buttonTitle,
      options: { opensAppToForeground: a.opensAppToForeground, ...(a.isDestructive ? { isDestructive: true } : {}) },
    }))
  );
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

// `extra` carries an inline notification action (categoryIdentifier) and
// the data an action's response listener needs (e.g. habitId) - optional,
// since most callers just want a plain reminder.
interface NotificationExtra {
  categoryIdentifier?: string;
  data?: Record<string, unknown>;
}

export async function scheduleDailyNotification(
  title: string,
  body: string,
  time: string,
  extra?: NotificationExtra
): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const { hour, minute } = parseTime(time);
  return Notifications.scheduleNotificationAsync({
    content: { title, body, ...extra },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelNotification(id: string | null): Promise<void> {
  if (!Notifications || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}

// Today at `time` if that hasn't passed yet, otherwise tomorrow at `time`.
export function computeNextOccurrence(time: string): Date {
  const { hour, minute } = parseTime(time);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// Fires as close to immediately as the OS allows (trigger: null) - used for
// the smoking-hotspot deterrence alert, not a scheduled reminder.
export async function scheduleImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Notifications) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, ...(data ? { data } : {}) },
    trigger: { channelId: DETERRENT_CHANNEL_ID },
  });
}

// A DAILY trigger repeats the same fixed content forever - a habit whose
// notification text needs to change day to day (e.g. a declining target)
// has to be rescheduled as a fresh one-time notification instead.
export async function scheduleOneTimeNotification(
  title: string,
  body: string,
  date: Date,
  extra?: NotificationExtra
): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, ...extra },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

// Marks a "checkin" habit done for today directly in the DB - not through
// the zustand store, since this can run from a notification action while
// the app has no React tree mounted yet (same reasoning as the geofencing
// task handler in lib/geofencing.ts). Never downgrades an already-higher
// amount (e.g. a real amount-tracked habit logged normally beats this).
async function markCheckedInToday(habitId: string): Promise<void> {
  const db = await getDb();
  const today = todayISO();
  const existing = await db.getFirstAsync<{ id: string; amount: number }>(
    "SELECT id, amount FROM daily_logs WHERE habitId = ? AND date = ?",
    [habitId, today]
  );
  const id = existing?.id ?? genId();
  const nextAmount = Math.max(1, existing?.amount ?? 0);
  await db.runAsync(
    `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
    [id, habitId, today, nextAmount, "[]", null]
  );
}

// Raw-DB version of the store's incrementAmount, for the same reason every
// other function in this file is raw DB - a notification action can fire
// with no React tree mounted.
async function incrementHabitAmountToday(habitId: string, delta: number): Promise<void> {
  const db = await getDb();
  const today = todayISO();
  const existing = await db.getFirstAsync<{ id: string; amount: number }>(
    "SELECT id, amount FROM daily_logs WHERE habitId = ? AND date = ?",
    [habitId, today]
  );
  const id = existing?.id ?? genId();
  const nextAmount = Math.max(0, (existing?.amount ?? 0) + delta);
  await db.runAsync(
    `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
    [id, habitId, today, nextAmount, "[]", null]
  );
}

// The hotspot deterrent alert, with inline "I {verb}" / "I didn't" /
// "Dismiss" actions - registers this habit's own category on demand (see
// hotspotCategory in lib/notificationContent.ts for why it is per-habit).
//
// Every path that raises this alert (the geofence task with the app closed,
// the open habit screen) goes through here, so the cooldown and the fixed
// per-habit identifier below make sure one habit never gets a second alert
// inside the cooldown, or two stacked copies. Returns whether it fired.
export async function scheduleHotspotDeterrentNotification(
  habitId: string,
  templateId: string | null | undefined
): Promise<boolean> {
  if (!Notifications) return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  if (!claimHotspotSlot(habitId)) return false;
  const built = buildHotspotNotification(habitId, templateId);
  if (built.category) await registerCategory(built.category);
  await Notifications.scheduleNotificationAsync({
    // A fixed identifier makes a second alert for the same habit replace the
    // first in the shade instead of stacking.
    identifier: `hotspot-alert-${habitId}`,
    content: built.content,
    trigger: { channelId: DETERRENT_CHANNEL_ID },
  });
  return true;
}

// Minimum gap between hotspot alerts for one habit - also restarted by an "I
// smoked" tap, so logging one never triggers another alert straight away.
const HOTSPOT_COOLDOWN_MS = 60 * 60 * 1000;

function hotspotCooldownKey(habitId: string): string {
  return `hotspot-cooldown:${habitId}`;
}

// Read-check-write with no await in between, so two alerts racing in the same
// JS runtime (e.g. a geofence event per overlapping region) can't both pass.
function claimHotspotSlot(habitId: string): boolean {
  const last = Number(Storage.getItemSync(hotspotCooldownKey(habitId)) ?? 0);
  if (Date.now() - last < HOTSPOT_COOLDOWN_MS) return false;
  startHotspotCooldown(habitId);
  return true;
}

function startHotspotCooldown(habitId: string): void {
  Storage.setItemSync(hotspotCooldownKey(habitId), String(Date.now()));
}

// The nightly summary of a "reduce" goal. Its day number and target change
// every day and a scheduled notification can't update its own text, so this
// works out both for the day it will actually FIRE on (tonight, or tomorrow if
// tonight's time has already passed) - not for today, which showed "Day 1" on
// day 2 whenever the habit was created or the app opened after summary time.
// The "logged so far" count is only included when it fires today.
export async function scheduleReduceSummary(
  habit: {
    id: string;
    createdAt: string;
    baselineQuantity: number | null;
    reduceDays: number | null;
    unit: string | null;
    summaryTime: string | null;
  },
  todayAmount: number
): Promise<string | null> {
  if (!habit.summaryTime) return null;
  const fireAt = computeNextOccurrence(habit.summaryTime);
  const fireDate = isoDate(fireAt);
  const { title, body, data } = buildReduceSummaryNotification({
    habitId: habit.id,
    day: reduceCycleDayForDate(habit, fireDate),
    cycleDays: habit.reduceDays ?? REDUCE_CYCLE_DAYS,
    target: reduceDailyTargetForDate(habit, fireDate),
    todayAmount: fireDate === todayISO() ? todayAmount : null,
    unit: habit.unit,
  }).content;
  return scheduleOneTimeNotification(title, body, fireAt, { data });
}

// The actions below write straight to the DB (no React tree may be mounted),
// so an already-running app's zustand store has to be told to re-read that
// habit afterwards - otherwise it shows the old count, and the next in-app tap
// on "+" would compute from it and overwrite the notification's log. Loaded
// lazily because lib/store.ts imports this file. With no store running (app
// killed, task in a headless runtime) there is nothing to refresh: init() reads
// the DB fresh next time the app opens. Must not wait for the store - a headless
// task that never resolves is never allowed to finish.
async function refreshStoreForHabit(habitId: string): Promise<void> {
  const { useStore } = require("./store") as typeof import("./store");
  if (!useStore.getState().ready) return;
  await useStore.getState().refreshHabit(habitId);
}

const NOTIFICATION_ACTION_TASK = "notification-action-task";
const DISMISS_ACTION_IDS = new Set([HOTSPOT_DISMISS_ACTION_ID, DOSE_DISMISS_ACTION_ID]);
const OWN_ACTION_IDS = new Set([
  WALK_ACTION_ID,
  DOSE_ACTION_ID,
  HOTSPOT_YES_ACTION_ID,
  HOTSPOT_NO_ACTION_ID,
  ...DISMISS_ACTION_IDS,
]);

// One notification tap can reach this file twice - once through the response
// listener and once through the background task (an app that is alive but in
// the background gets both) - so each tap is claimed before it is handled. The
// posted-time is part of the key because a hotspot alert reuses one fixed
// identifier per habit. Sync read-then-write: no await in between, so two
// callers in one runtime can't both claim it.
function claimActionOnce(identifier: string, notificationDate: unknown, actionIdentifier: string): boolean {
  const key = `action-handled:${identifier}:${String(notificationDate)}:${actionIdentifier}`;
  if (Storage.getItemSync(key) !== null) return false;
  Storage.setItemSync(key, "1");
  return true;
}

// The in-app response listener hands over notification data already parsed
// (content.data), but the background-task payload is the raw native bundle,
// where it is only present as a JSON string (content.dataString).
function readActionData(content: { data?: unknown; dataString?: unknown }): Record<string, unknown> | undefined {
  if (content.data && typeof content.data === "object") return content.data as Record<string, unknown>;
  if (typeof content.dataString === "string") {
    try {
      return JSON.parse(content.dataString) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Handles one of our own action buttons. None of them open the app - the DB is
// written right here, from whichever runtime the tap reached (the running app,
// or a headless one when the app was killed), and the next app open reads it.
async function handleNotificationAction(response: NotificationResponse): Promise<void> {
  const { actionIdentifier } = response;
  testLog("response received", actionIdentifier);
  if (!OWN_ACTION_IDS.has(actionIdentifier)) return;
  const { identifier, content } = response.notification.request;
  if (!claimActionOnce(identifier, response.notification.date, actionIdentifier)) return;
  const data = readActionData(content);
  testLog("action pressed", { identifier, actionIdentifier, data });

  const habitId = data?.habitId;

  if (actionIdentifier === HOTSPOT_NO_ACTION_ID && typeof habitId === "string") {
    // "I didn't" - the count is left alone; the alert is swapped for a short
    // encouragement worded for this habit instead of just vanishing.
    await showEncouragement(identifier, habitId);
    return;
  }

  // Android never removes a notification when one of its action buttons is
  // tapped (neither the OS nor expo-notifications does it) - without this
  // every button would leave the alert sitting in the shade.
  await Notifications?.dismissNotificationAsync(identifier).catch(() => {});

  if (typeof habitId !== "string") return;
  if (actionIdentifier === WALK_ACTION_ID) {
    await markCheckedInToday(habitId);
  } else if (actionIdentifier === DOSE_ACTION_ID) {
    await markDoseTaken(habitId);
  } else if (actionIdentifier === HOTSPOT_YES_ACTION_ID) {
    // "I smoked/drank/chewed" - one more logged today, same math as tapping
    // the in-app Counter's + button.
    await incrementHabitAmountToday(habitId, 1);
    startHotspotCooldown(habitId);
  } else {
    // The Dismiss buttons leave the count alone.
    return;
  }
  await refreshStoreForHabit(habitId);
}

// Posting with the alert's own identifier replaces it in the shade (Android keys
// a notification by identifier), so this needs no separate dismiss.
async function showEncouragement(alertIdentifier: string, habitId: string): Promise<void> {
  if (!Notifications) return;
  const db = await getDb();
  const habit = await db.getFirstAsync<{ templateId: string }>("SELECT templateId FROM habits WHERE id = ?", [habitId]);
  const { content } = buildEncouragementNotification(habitId, habit?.templateId);
  await Notifications.scheduleNotificationAsync({ identifier: alertIdentifier, content, trigger: null });
}

if (Notifications) {
  testLog("notifications module loaded");
  // The morning-walk check-in and dose reminder categories are fixed, so
  // they register once here. The hotspot category is per-habit and registers
  // on demand right before scheduling (scheduleHotspotDeterrentNotification).
  registerCategory(WALK_CATEGORY).catch(() => {});
  registerCategory(DOSE_CATEGORY).catch(() => {});

  if (isNotificationTestEnabled()) {
    Notifications.addNotificationReceivedListener((notification) => {
      const { identifier, content } = notification.request;
      testLog("received in foreground", { identifier, title: content.title, data: content.data });
    });
  }

  // The action buttons don't open the app, so with the app killed the only
  // thing that runs for a tap is this background task (expo-notifications runs
  // it, in a headless JS runtime, for a custom action tapped while the app is
  // backgrounded or terminated). The listener below covers the foreground case,
  // where no task runs. The executor is awaited so Android keeps the process
  // alive until the DB write lands, and must never throw.
  TaskManager.defineTask<NotificationTaskPayload>(NOTIFICATION_ACTION_TASK, async ({ data }) => {
    if (!data || !("actionIdentifier" in data)) return;
    testLog("background task action", data.actionIdentifier);
    await handleNotificationAction(data).catch((e) => testLog("action failed", String(e)));
  });
  Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK).catch(() => {});

  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationAction(response).catch((e) => testLog("action failed", String(e)));
  });
}

export { DOSE_CATEGORY_ID };

// A dose taken can happen several times a day - additive, not set-to-1 like
// markCheckedInToday above (which is for once-a-day check-in habits).
async function markDoseTaken(habitId: string): Promise<void> {
  const db = await getDb();
  const today = todayISO();
  const existing = await db.getFirstAsync<{ id: string; amount: number }>(
    "SELECT id, amount FROM daily_logs WHERE habitId = ? AND date = ?",
    [habitId, today]
  );
  const id = existing?.id ?? genId();
  const nextAmount = (existing?.amount ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO daily_logs (id, habitId, date, amount, microtasksDone, reflection)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(habitId, date) DO UPDATE SET amount = excluded.amount`,
    [id, habitId, today, nextAmount, "[]", null]
  );
  await adjustStock(habitId, 1);
}

// A 3-day buffer sized to how often the habit is actually taken, rather
// than a flat tablet count - "3 left" means very different things at
// 1x/day vs 4x/day.
const LOW_STOCK_DAYS = 3;

// Shared by the in-app Counter (lib/store.ts's incrementAmount, positive
// delta = one more dose logged = consume a tablet, negative = undo/restore)
// and the notification action above (always a consuming +1). No-ops if
// stock tracking was never turned on for this habit (stockRemaining null).
// Returns the new stock count, or null if tracking is off, so callers can
// merge it back into their own state.
export async function adjustStock(habitId: string, amountDelta: number): Promise<number | null> {
  const db = await getDb();
  const habit = await db.getFirstAsync<{
    stockRemaining: number | null;
    dosageFrequency: string | null;
    name: string;
    lowStockNotifiedAt: string | null;
  }>("SELECT stockRemaining, dosageFrequency, name, lowStockNotifiedAt FROM habits WHERE id = ?", [habitId]);
  if (!habit || habit.stockRemaining === null) return null;

  const nextStock = Math.max(0, habit.stockRemaining - amountDelta);
  await db.runAsync("UPDATE habits SET stockRemaining = ? WHERE id = ?", [nextStock, habitId]);

  if (amountDelta > 0) {
    const today = todayISO();
    const timesPerDay = parseDosageFrequency(habit.dosageFrequency);
    if (nextStock <= timesPerDay * LOW_STOCK_DAYS && habit.lowStockNotifiedAt !== today) {
      await db.runAsync("UPDATE habits SET lowStockNotifiedAt = ? WHERE id = ?", [today, habitId]);
      const { content } = buildLowStockNotification(habitId, habit.name, nextStock);
      await scheduleImmediateNotification(content.title, content.body, content.data);
    }
  }

  return nextStock;
}

// A periodic reminder that repeats every `seconds` (e.g. every N days for a
// checkup) - not tied to a specific time of day, unlike the DAILY trigger.
export async function scheduleIntervalReminder(
  title: string,
  body: string,
  seconds: number,
  extra?: NotificationExtra
): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, ...extra },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: true,
    },
  });
}

export async function scheduleMorningWalkReminder(habitId: string, time: string): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const { hour, minute } = parseTime(time);
  return Notifications.scheduleNotificationAsync({
    content: buildWalkNotification(habitId).content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export type TestNotificationResult =
  | { status: "scheduled"; labels: string[]; delaySeconds: number }
  | { status: "unavailable" | "denied" | "nothing-to-test" };

// Developer-only: schedules a one-off copy of each notification this habit
// really produces (same content, category, channel and data as the real
// schedulers - see buildHabitTestNotifications), `delaySeconds` from now and
// 5s apart when there are several. Unique identifiers, never touches a real
// scheduled notification. Tests deliberately get no special handling in the
// response listener above - they must exercise the real action code path.
export async function fireTestNotification(
  habit: Habit,
  todayAmount: number,
  delaySeconds = 5
): Promise<TestNotificationResult> {
  if (!Notifications) return { status: "unavailable" };
  const granted = await ensureNotificationPermission();
  if (!granted) return { status: "denied" };

  const tests = buildHabitTestNotifications(habit, todayAmount);
  if (tests.length === 0) return { status: "nothing-to-test" };

  await ensureDeterrentChannel();
  const stamp = Date.now();
  for (let i = 0; i < tests.length; i++) {
    const { label, built } = tests[i];
    if (built.category) await registerCategory(built.category);
    const fireAt = new Date(stamp + (delaySeconds + i * 5) * 1000);
    const identifier = `test-${habit.id}-${i}-${stamp}`;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { ...built.content, data: { ...built.content.data, isTest: true } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(built.channelId ? { channelId: built.channelId } : {}),
      },
    });
    testLog("test scheduled", { identifier, label, fireAt: fireAt.toISOString() });
  }
  return { status: "scheduled", labels: tests.map((t) => t.label), delaySeconds };
}

// Calls `onOpen(habitId)` when the user taps a habit notification itself, so
// the app can land on that habit. Covers a cold start (the tap that launched
// the app) as well as a running app. The action buttons don't open the app.
export function subscribeToNotificationOpens(onOpen: (habitId: string) => void): () => void {
  const N = Notifications;
  if (!N) return () => {};
  const seen = new Set<string>();

  const handle = (response: NotificationResponse | null | undefined) => {
    if (!response) return;
    const { actionIdentifier } = response;
    const habitId = response.notification.request.content.data?.habitId;
    if (actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER || typeof habitId !== "string") return;
    // The cold-start lookup and the live listener can both report the same tap.
    const key = `${response.notification.request.identifier}:${actionIdentifier}:${response.notification.date}`;
    if (seen.has(key)) return;
    seen.add(key);
    N.clearLastNotificationResponse();
    onOpen(habitId);
  };

  handle(N.getLastNotificationResponse());
  const subscription = N.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

import * as TaskManager from "expo-task-manager";
import type { NotificationTaskPayload } from "expo-notifications";
import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { parseDosageFrequency } from "./medicationParse";
import {
  buildHabitTestNotifications,
  buildHotspotNotification,
  buildLowStockNotification,
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

function testLog(...args: unknown[]): void {
  if (isNotificationTestEnabled()) console.log("[notif-test]", ...args);
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
export async function scheduleImmediateNotification(title: string, body: string): Promise<void> {
  if (!Notifications) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
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
// with no React tree mounted. delta=0 (the hotspot's "I didn't" action)
// still upserts a same-day row so a clean day counts for streaks/goals,
// without changing the amount - same effect as delta=0 through the store.
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
export async function scheduleHotspotDeterrentNotification(
  habitId: string,
  templateId: string | null | undefined
): Promise<void> {
  if (!Notifications) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  const built = buildHotspotNotification(habitId, templateId);
  if (built.category) await registerCategory(built.category);
  await Notifications.scheduleNotificationAsync({
    content: built.content,
    trigger: { channelId: DETERRENT_CHANNEL_ID },
  });
}

// The actions above write straight to the DB (no React tree may be mounted),
// so the zustand store has to be told to re-read that habit afterwards -
// otherwise an already-open app shows the old count, and the next in-app tap
// on "+" would compute from it and overwrite the notification's log. Loaded
// lazily because lib/store.ts imports this file. If the store is still
// starting up (app cold-launched by the tap), wait for it: init() may have
// read the DB before the write landed.
async function refreshStoreForHabit(habitId: string): Promise<void> {
  const { useStore } = require("./store") as typeof import("./store");
  if (!useStore.getState().ready) {
    await new Promise<void>((resolve) => {
      const unsubscribe = useStore.subscribe((state) => {
        if (state.ready) {
          unsubscribe();
          resolve();
        }
      });
    });
  }
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

if (Notifications) {
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

  // Android never removes a notification when one of its action buttons is
  // tapped (neither the OS nor expo-notifications does it) - without this
  // every button would leave the alert sitting in the shade, and "Dismiss"
  // would do nothing at all.
  //
  // With the app backgrounded or killed, a "Dismiss" tap (opensAppToForeground
  // false) never reaches the JS listener below; expo-notifications only runs a
  // registered background task for it. So that task handles ONLY the dismiss
  // actions - the log-something actions open the app and are handled once by
  // the listener, and letting the task handle them too would double-count.
  TaskManager.defineTask<NotificationTaskPayload>(NOTIFICATION_ACTION_TASK, async ({ data }) => {
    if (!data || !("actionIdentifier" in data)) return;
    testLog("background task action", data.actionIdentifier);
    if (DISMISS_ACTION_IDS.has(data.actionIdentifier)) {
      await Notifications?.dismissNotificationAsync(data.notification.request.identifier);
    }
  });
  Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK).catch(() => {});

  Notifications.addNotificationResponseReceivedListener((response) => {
    testLog("action pressed", {
      identifier: response.notification.request.identifier,
      actionIdentifier: response.actionIdentifier,
      data: response.notification.request.content.data,
    });
    if (OWN_ACTION_IDS.has(response.actionIdentifier)) {
      Notifications?.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    }
    const habitId = response.notification.request.content.data?.habitId;
    if (typeof habitId !== "string") return;
    let write: Promise<void> | null = null;
    if (response.actionIdentifier === WALK_ACTION_ID) {
      write = markCheckedInToday(habitId);
    } else if (response.actionIdentifier === DOSE_ACTION_ID) {
      write = markDoseTaken(habitId);
    } else if (response.actionIdentifier === HOTSPOT_YES_ACTION_ID) {
      // "I smoked/drank/chewed" - one more logged today, same math as
      // tapping the in-app Counter's + button.
      write = incrementHabitAmountToday(habitId, 1);
    } else if (response.actionIdentifier === HOTSPOT_NO_ACTION_ID) {
      // "I didn't" - same as the "I stayed {x}-free today" button: ensures
      // today has a logged (clean) day for streak/goal purposes, without
      // adding to the count.
      write = incrementHabitAmountToday(habitId, 0);
    }
    write?.then(() => refreshStoreForHabit(habitId)).catch(() => {});
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
      const { content } = buildLowStockNotification(habit.name, nextStock);
      await scheduleImmediateNotification(content.title, content.body);
    }
  }

  return nextStock;
}

// A periodic reminder that repeats every `seconds` (e.g. every N days for a
// checkup) - not tied to a specific time of day, unlike the DAILY trigger.
export async function scheduleIntervalReminder(title: string, body: string, seconds: number): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
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

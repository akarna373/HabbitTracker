import { getDb } from "./db";
import { genId } from "./id";
import { todayISO } from "./dates";
import { parseDosageFrequency } from "./medicationParse";

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
const DETERRENT_CHANNEL_ID = "deterrent";
if (Notifications) {
  // "default" isn't a real sound resource name on Android here (it wants an
  // actual registered file, or nothing) - omitting it lets the channel use
  // the system's own default notification sound.
  Notifications.setNotificationChannelAsync(DETERRENT_CHANNEL_ID, {
    name: "Location deterrent alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => {});
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

// The morning-walk check-in: a daily reminder with an inline "I went for a
// walk" action, so the user can log it without opening the app - matches
// how the OS presents notification action buttons (tapping one dismisses
// the notification without launching the app to the foreground).
const WALK_CATEGORY_ID = "morning-walk-check";
const WALK_ACTION_ID = "log-walk";

// A dose reminder's inline "I took it" action - same reasoning as the walk
// check-in above (log without opening the app).
const DOSE_CATEGORY_ID = "medication-dose-check";
const DOSE_ACTION_ID = "took-dose";
// No handler branch needed for this one - the response listener below only
// acts on identifiers it recognizes, so Dismiss just closes the
// notification without touching the dose count or stock.
const DOSE_DISMISS_ACTION_ID = "dismiss-dose";

if (Notifications) {
  Notifications.setNotificationCategoryAsync(WALK_CATEGORY_ID, [
    { identifier: WALK_ACTION_ID, buttonTitle: "I went for a walk", options: { opensAppToForeground: false } },
  ]).catch(() => {});

  Notifications.setNotificationCategoryAsync(DOSE_CATEGORY_ID, [
    { identifier: DOSE_ACTION_ID, buttonTitle: "I took it", options: { opensAppToForeground: false } },
    {
      identifier: DOSE_DISMISS_ACTION_ID,
      buttonTitle: "Dismiss",
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]).catch(() => {});

  Notifications.addNotificationResponseReceivedListener((response) => {
    const habitId = response.notification.request.content.data?.habitId;
    if (typeof habitId !== "string") return;
    if (response.actionIdentifier === WALK_ACTION_ID) {
      markCheckedInToday(habitId).catch(() => {});
    } else if (response.actionIdentifier === DOSE_ACTION_ID) {
      markDoseTaken(habitId).catch(() => {});
    }
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
      await scheduleImmediateNotification(`Running low on ${habit.name}`, `Only ${nextStock} left - time to restock.`);
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
    content: {
      title: "Did you go for a morning walk?",
      body: "Even a 30 minute walk can improve your heart. Trust me.",
      categoryIdentifier: WALK_CATEGORY_ID,
      data: { habitId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

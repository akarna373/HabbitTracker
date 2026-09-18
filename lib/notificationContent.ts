import { parseDosageFrequency, parseDurationDays } from "./medicationParse";
import { pickEncouragementMessage } from "./motivation";
import { getQuitCopy } from "./templates";
import type { Habit } from "./types";

// Pure - no expo-notifications import - so the real schedulers (lib/store.ts,
// lib/medicationSchedule.ts, lib/notifications.ts) and the developer "Test
// notification" button build every notification's content, category, channel
// and data from the same place. Change wording here and both follow.

export const DETERRENT_CHANNEL_ID = "deterrent";

export const WALK_CATEGORY_ID = "morning-walk-check";
export const WALK_ACTION_ID = "log-walk";

export const DOSE_CATEGORY_ID = "medication-dose-check";
export const DOSE_ACTION_ID = "took-dose";
export const DOSE_DISMISS_ACTION_ID = "dismiss-dose";
export const DOSE_MISSED_ACTION_ID = "missed-dose";

// The follow-up sent after "I missed it" on a dose reminder.
export const DOSE_MISSED_CATEGORY_ID = "medication-missed-dose-check";
export const DOSE_MISSED_YES_ACTION_ID = "took-missed-dose";
export const DOSE_MISSED_DISMISS_ACTION_ID = "dismiss-missed-dose";

export const HOTSPOT_YES_ACTION_ID = "hotspot-yes";
export const HOTSPOT_NO_ACTION_ID = "hotspot-no";
export const HOTSPOT_DISMISS_ACTION_ID = "hotspot-dismiss";

export interface NotificationActionSpec {
  identifier: string;
  buttonTitle: string;
  opensAppToForeground: boolean;
  isDestructive?: boolean;
}

export interface NotificationCategorySpec {
  id: string;
  actions: NotificationActionSpec[];
}

export interface BuiltNotification {
  content: {
    title: string;
    body: string;
    categoryIdentifier?: string;
    data?: Record<string, unknown>;
  };
  // Undefined = the platform's default channel, same as a plain reminder.
  channelId?: string;
  // The category to register before this fires, when content names one.
  category?: NotificationCategorySpec;
}

// Fixed category specs - registered once at module load (lib/notifications.ts).
// No action opens the app to the foreground: tapping one logs straight to the
// DB through the background task in lib/notifications.ts, so it works with the
// app killed. Only tapping the notification body opens the app.
export const WALK_CATEGORY: NotificationCategorySpec = {
  id: WALK_CATEGORY_ID,
  actions: [{ identifier: WALK_ACTION_ID, buttonTitle: "I went for a walk", opensAppToForeground: false }],
};

// Dismiss needs no handler branch - the response listener only acts on
// identifiers it recognizes, so it just closes the notification.
export const DOSE_CATEGORY: NotificationCategorySpec = {
  id: DOSE_CATEGORY_ID,
  actions: [
    { identifier: DOSE_ACTION_ID, buttonTitle: "I took it", opensAppToForeground: false },
    { identifier: DOSE_MISSED_ACTION_ID, buttonTitle: "I missed it", opensAppToForeground: false },
    { identifier: DOSE_DISMISS_ACTION_ID, buttonTitle: "Dismiss", opensAppToForeground: false, isDestructive: true },
  ],
};

export const DOSE_MISSED_CATEGORY: NotificationCategorySpec = {
  id: DOSE_MISSED_CATEGORY_ID,
  actions: [
    { identifier: DOSE_MISSED_YES_ACTION_ID, buttonTitle: "Yes I took it", opensAppToForeground: false },
    {
      identifier: DOSE_MISSED_DISMISS_ACTION_ID,
      buttonTitle: "Dismiss",
      opensAppToForeground: false,
      isDestructive: true,
    },
  ],
};

// Button labels need the habit's own verb ("I smoked"/"I drank"/...), so this
// category is per-habit and registered on demand, not once at module load.
export function hotspotCategory(habitId: string, verb: string): NotificationCategorySpec {
  return {
    id: `hotspot-${habitId}`,
    actions: [
      { identifier: HOTSPOT_YES_ACTION_ID, buttonTitle: `I ${verb}`, opensAppToForeground: false },
      { identifier: HOTSPOT_NO_ACTION_ID, buttonTitle: "I didn't", opensAppToForeground: false },
      { identifier: HOTSPOT_DISMISS_ACTION_ID, buttonTitle: "Dismiss", opensAppToForeground: false, isDestructive: true },
    ],
  };
}

// Every habit-owned notification carries data.habitId so tapping it (or an
// action that opens the app) can land on that habit - see
// subscribeToNotificationOpens in lib/notifications.ts.
export function buildReminderNotification(habitId: string, name: string): BuiltNotification {
  return { content: { title: name, body: "A gentle reminder to check in today.", data: { habitId } } };
}

export function buildWalkNotification(habitId: string): BuiltNotification {
  return {
    content: {
      title: "Did you go for a morning walk?",
      body: "Even a 30 minute walk can improve your heart. Trust me.",
      categoryIdentifier: WALK_CATEGORY_ID,
      data: { habitId },
    },
    category: WALK_CATEGORY,
  };
}

export function buildCheckupNotification(habitId: string, name: string): BuiltNotification {
  return {
    content: {
      title: "Time for a checkup",
      body: `It's been a while - book your ${name.toLowerCase()}.`,
      data: { habitId },
    },
  };
}

// `dayNumber`/`durationDays` are set for a fixed-length course ("...dose 2 of
// 3, day 4 of 10") and omitted for an ongoing one ("...dose 2 of 3").
export function buildDoseNotification(params: {
  habitId: string;
  name: string;
  doseAmount: number | null;
  doseUnit: string | null;
  doseOfDay: number;
  timesPerDay: number;
  dayNumber?: number;
  durationDays?: number;
}): BuiltNotification {
  const doseLabel = `${params.doseAmount ?? ""} ${params.doseUnit ?? ""}`.trim();
  const dayPart =
    params.dayNumber !== undefined && params.durationDays !== undefined
      ? `, day ${params.dayNumber} of ${params.durationDays}`
      : "";
  return {
    content: {
      title: `Take ${params.name}`,
      body: `${doseLabel} - dose ${params.doseOfDay} of ${params.timesPerDay}${dayPart}`,
      categoryIdentifier: DOSE_CATEGORY_ID,
      data: { habitId: params.habitId },
    },
    category: DOSE_CATEGORY,
  };
}

// Sent after "I missed it" on a dose reminder.
export function buildMissedDoseFollowUpNotification(habitId: string, name: string): BuiltNotification {
  return {
    content: {
      title: "Missed dose",
      body: `Did you take the missed ${name}?`,
      categoryIdentifier: DOSE_MISSED_CATEGORY_ID,
      data: { habitId },
    },
    category: DOSE_MISSED_CATEGORY,
  };
}

// Sent through the deterrent channel because that is what the real low-stock
// alert uses (scheduleImmediateNotification).
export function buildLowStockNotification(habitId: string, name: string, remaining: number): BuiltNotification {
  return {
    content: {
      title: `Running low on ${name}`,
      body: `Only ${remaining} left - time to restock.`,
      data: { habitId },
    },
    channelId: DETERRENT_CHANNEL_ID,
  };
}

export function buildHotspotNotification(habitId: string, templateId: string | null | undefined): BuiltNotification {
  const { locationNoun, verb } = getQuitCopy(templateId);
  return {
    content: {
      title: `You're at your ${locationNoun} location`,
      body: "Please move away from this spot - it's better for your health and your finances.",
      categoryIdentifier: `hotspot-${habitId}`,
      data: { habitId },
    },
    channelId: DETERRENT_CHANNEL_ID,
    category: hotspotCategory(habitId, verb),
  };
}

// Replaces the hotspot alert after "I didn't" (same identifier - see
// handleNotificationAction). No buttons and no deterrent channel: it is praise,
// not a warning, so it shouldn't buzz like one. Tapping it opens the habit.
export function buildEncouragementNotification(habitId: string, templateId: string | null | undefined): BuiltNotification {
  return {
    content: { title: "Well done", body: pickEncouragementMessage(templateId), data: { habitId } },
  };
}

export interface HabitTestNotification {
  label: string;
  built: BuiltNotification;
}

// Every notification this habit can really produce, mirroring which ones
// createHabit schedules - used by the developer Test button. `todayAmount` only
// feeds the reduce-goal summary text ("You've logged N so far").
export function buildHabitTestNotifications(habit: Habit, todayAmount: number): HabitTestNotification[] {
  const out: HabitTestNotification[] = [];

  if (habit.templateId === "medication") {
    const timesPerDay = parseDosageFrequency(habit.dosageFrequency);
    const durationDays = parseDurationDays(habit.durationType);
    out.push({
      label: "dose reminder",
      built: buildDoseNotification({
        habitId: habit.id,
        name: habit.name,
        doseAmount: habit.doseAmount,
        doseUnit: habit.doseUnit,
        doseOfDay: 1,
        timesPerDay,
        ...(durationDays !== null ? { dayNumber: 1, durationDays } : {}),
      }),
    });
    if (habit.stockRemaining !== null) {
      out.push({ label: "low-stock alert", built: buildLowStockNotification(habit.id, habit.name, habit.stockRemaining) });
    }
  } else if (habit.templateId === "doctor_checkup" && habit.checkupIntervalDays) {
    out.push({ label: "checkup reminder", built: buildCheckupNotification(habit.id, habit.name) });
  } else if (habit.reminderEnabled && habit.reminderTime) {
    out.push(
      habit.templateId === "walking_jogging"
        ? { label: "morning walk reminder", built: buildWalkNotification(habit.id) }
        : { label: "daily reminder", built: buildReminderNotification(habit.id, habit.name) }
    );
  }

  if (habit.kind === "quit" && habit.hasCost) {
    out.push({ label: "hotspot alert", built: buildHotspotNotification(habit.id, habit.templateId) });
  }

  return out;
}

import { cancelNotification, DOSE_CATEGORY_ID, scheduleDailyNotification, scheduleOneTimeNotification } from "./notifications";
import { parseDosageFrequency, parseDurationDays } from "./medicationParse";
import { addDays, todayISO } from "./dates";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function combineDateTime(dateISO: string, time: string): Date {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const { hour, minute } = { hour: Math.floor(parseTimeToMinutes(time) / 60), minute: parseTimeToMinutes(time) % 60 };
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

// A plain 24/N even split puts the last of 3 doses at midnight (8am, 4pm,
// 12am) and the 2nd of 2 doses exactly 12h later - both impractical to
// actually take. bd gets a slightly-longer-than-half gap (still one
// morning, one evening dose) and tds a shorter one (fits inside waking
// hours instead of spanning the full day); od has only one dose, so there's
// no gap to pick - the user's own chosen time is the only dose time.
function defaultGapHours(timesPerDay: number): number {
  if (timesPerDay === 2) return 13;
  if (timesPerDay === 3) return 6;
  return 24 / timesPerDay;
}

export interface DoseOccurrence {
  date: string; // "YYYY-MM-DD" AD
  time: string; // "HH:mm"
}

export interface DoseScheduleParams {
  dosageFrequency: string | null;
  durationType: string | null;
  startTime: string; // "HH:mm"
  startDate: string; // "YYYY-MM-DD"
  // Bypasses parsing durationType for the day count - used by
  // getCourseCalendarView below to force a rolling window for an ongoing
  // ("Daily") medication. Every other call site omits this.
  durationDaysOverride?: number;
}

// The full, unclamped list of every dose the course actually needs - null
// for an ongoing ("Daily") duration with no override, since there's no
// fixed range to enumerate. Resets to startTime at the start of every
// calendar day (not one continuous sequence carried across midnight) - the
// gap is now a fixed practical value (see defaultGapHours), not always an
// even divisor of 24h, so a continuous sequence would drift and land a
// 4th dose in some days for tds (6h gap x 3 = 18h, not 24h). Shared by
// scheduleMedicationNotifications (below) and the course calendar screen,
// so there's one source of truth for "the schedule" instead of two places
// computing it slightly differently.
export function computeDoseOccurrences(params: DoseScheduleParams): DoseOccurrence[] | null {
  const timesPerDay = parseDosageFrequency(params.dosageFrequency);
  const durationDays = params.durationDaysOverride ?? parseDurationDays(params.durationType);
  if (durationDays === null) return null;

  const gapHours = defaultGapHours(timesPerDay);
  const startMinutes = parseTimeToMinutes(params.startTime);
  const occurrences: DoseOccurrence[] = [];
  for (let day = 0; day < durationDays; day++) {
    const dayDate = addDays(params.startDate, day);
    for (let i = 0; i < timesPerDay; i++) {
      const totalMinutes = startMinutes + i * gapHours * 60;
      // A dose that lands past midnight (a very late start time + a long
      // gap) belongs to the next calendar date, not dayDate with a wrapped
      // clock time - this keeps that case correctly dated too.
      const dayOffset = Math.floor(totalMinutes / (24 * 60));
      occurrences.push({ date: addDays(dayDate, dayOffset), time: minutesToTimeString(totalMinutes) });
    }
  }
  return occurrences;
}

// A chronic/ongoing medication (Duration "Daily") has no fixed end - the
// course calendar would otherwise have to render forever. Cap what it
// shows to a rolling window instead, always starting from today (not the
// original start date, which could be long past for a chronic med).
const CHRONIC_ROLLING_DAYS = 30;

export interface CourseCalendarView {
  occurrences: DoseOccurrence[];
  isRolling: boolean;
}

// Tries the real fixed-duration course first; falls back to a rolling
// window for an ongoing duration. Used anywhere the course needs to be
// *displayed* (detail screen, the calendar screen) - notification
// scheduling for the ongoing case doesn't need this at all, it already
// uses cheap repeating DAILY triggers (see scheduleMedicationNotifications
// below), not an enumerated list.
export function getCourseCalendarView(params: {
  dosageFrequency: string | null;
  durationType: string | null;
  startTime: string;
  medicationStartDate: string;
}): CourseCalendarView {
  const fixed = computeDoseOccurrences({
    dosageFrequency: params.dosageFrequency,
    durationType: params.durationType,
    startTime: params.startTime,
    startDate: params.medicationStartDate,
  });
  if (fixed !== null) return { occurrences: fixed, isRolling: false };

  const rolling = computeDoseOccurrences({
    dosageFrequency: params.dosageFrequency,
    durationType: params.durationType,
    startTime: params.startTime,
    startDate: todayISO(),
    durationDaysOverride: CHRONIC_ROLLING_DAYS,
  }) as DoseOccurrence[];
  return { occurrences: rolling, isRolling: true };
}

// Headroom under iOS's 64-pending-local-notification cap (Android has no
// such cap) - only a very long Custom duration at high frequency clamps
// what actually gets *scheduled*; the course calendar still shows the full,
// true course via computeDoseOccurrences above, unclamped.
const MAX_SCHEDULED_DOSES = 60;

export interface MedicationScheduleParams {
  habitId: string;
  name: string;
  doseAmount: number | null;
  doseUnit: string | null;
  dosageFrequency: string | null;
  durationType: string | null;
  startTime: string; // "HH:mm"
  startDate: string; // "YYYY-MM-DD"
}

export async function scheduleMedicationNotifications(params: MedicationScheduleParams): Promise<string[]> {
  const timesPerDay = parseDosageFrequency(params.dosageFrequency);
  const doseLabel = `${params.doseAmount ?? ""} ${params.doseUnit ?? ""}`.trim();
  const title = `Take ${params.name}`;
  const ids: string[] = [];

  const occurrences = computeDoseOccurrences(params);

  if (occurrences === null) {
    // Ongoing - one repeating DAILY trigger per dose time of day, spaced
    // evenly from the start time. Cheap: each trigger holds exactly one
    // pending slot no matter how long it keeps firing.
    const startMinutes = parseTimeToMinutes(params.startTime);
    const gapHours = defaultGapHours(timesPerDay);
    for (let i = 0; i < timesPerDay; i++) {
      const time = minutesToTimeString(startMinutes + i * gapHours * 60);
      const body = `${doseLabel} - dose ${i + 1} of ${timesPerDay}`;
      const id = await scheduleDailyNotification(title, body, time, {
        categoryIdentifier: DOSE_CATEGORY_ID,
        data: { habitId: params.habitId },
      });
      if (id) ids.push(id);
    }
    return ids;
  }

  const durationDays = parseDurationDays(params.durationType) as number;
  const clamped = occurrences.slice(0, MAX_SCHEDULED_DOSES);
  for (let k = 0; k < clamped.length; k++) {
    const occ = clamped[k];
    const when = combineDateTime(occ.date, occ.time);
    const dayNumber = Math.floor(k / timesPerDay) + 1;
    const doseOfDay = (k % timesPerDay) + 1;
    const body = `${doseLabel} - dose ${doseOfDay} of ${timesPerDay}, day ${dayNumber} of ${durationDays}`;
    const id = await scheduleOneTimeNotification(title, body, when, {
      categoryIdentifier: DOSE_CATEGORY_ID,
      data: { habitId: params.habitId },
    });
    if (id) ids.push(id);
  }
  return ids;
}

// Just today's dose times ("HH:mm"), for the Home tile's "Next med at..."
// line - the gap pattern resets every calendar day (see the comment on
// computeDoseOccurrences above), so a single-day override always gives
// today's real times regardless of what day the course is actually on.
export function getTodayDoseTimes(params: {
  dosageFrequency: string | null;
  durationType: string | null;
  startTime: string;
}): string[] {
  const occurrences = computeDoseOccurrences({
    dosageFrequency: params.dosageFrequency,
    durationType: params.durationType,
    startTime: params.startTime,
    startDate: todayISO(),
    durationDaysOverride: 1,
  });
  return (occurrences ?? []).map((o) => o.time);
}

export async function cancelMedicationNotifications(ids: string[] | null): Promise<void> {
  if (!ids) return;
  for (const id of ids) {
    await cancelNotification(id);
  }
}

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import Storage from "expo-sqlite/kv-store";
import { getDb } from "./db";
import { findHotspots, HOTSPOT_RADIUS_METERS } from "./location";
import { scheduleImmediateNotification } from "./notifications";
import type { SmokeLocation } from "./types";

export const GEOFENCE_TASK_NAME = "smoke-location-geofence";

// Skip re-notifying for the same habit's hotspot within this window - the OS
// can re-fire Enter events while the user is just lingering at the spot.
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

async function getLastNotifiedAt(habitId: string): Promise<number> {
  const raw = await Storage.getItem(`geofence-cooldown:${habitId}`);
  return raw ? Number(raw) : 0;
}

async function setLastNotifiedAt(habitId: string): Promise<void> {
  await Storage.setItem(`geofence-cooldown:${habitId}`, String(Date.now()));
}

// Defined at module scope (imported unconditionally from app/_layout.tsx) so
// Android can invoke it headlessly - with no app UI running - which means it
// can't rely on the Zustand store or any React context, only plain DB/module
// calls like getDb() and scheduleImmediateNotification.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  if (eventType !== Location.GeofencingEventType.Enter || !region?.identifier) return;

  const [habitId] = region.identifier.split("::");
  if (!habitId) return;

  const lastNotifiedAt = await getLastNotifiedAt(habitId);
  if (Date.now() - lastNotifiedAt < COOLDOWN_MS) return;

  const db = await getDb();
  const habit = await db.getFirstAsync<{ id: string }>("SELECT id FROM habits WHERE id = ?", [habitId]);
  if (!habit) return;

  await scheduleImmediateNotification(
    "You're at your smoking location",
    "Please move away from this spot - it's better for your health and your finances."
  );
  await setLastNotifiedAt(habitId);
});

interface HabitForSync {
  id: string;
  locationTrackingEnabled: boolean;
  backgroundLocationEnabled: boolean;
}

// Only one geofencing task can be active system-wide, so this always
// replaces the *entire* region set - merging every eligible habit's hotspots
// into one call matches startGeofencingAsync's documented replace-on-recall
// behavior ("if you want to add or remove regions... just call
// startGeofencingAsync again with the new array").
export async function syncGeofences(
  habits: HabitForSync[],
  smokeLocationsByHabit: Record<string, SmokeLocation[]>
): Promise<void> {
  const regions: Location.LocationRegion[] = [];
  for (const habit of habits) {
    if (!habit.locationTrackingEnabled || !habit.backgroundLocationEnabled) continue;
    const hotspots = findHotspots(smokeLocationsByHabit[habit.id] ?? []);
    hotspots.forEach((hotspot, index) => {
      regions.push({
        identifier: `${habit.id}::${index}`,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        radius: HOTSPOT_RADIUS_METERS,
      });
    });
  }

  try {
    if (regions.length === 0) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      return;
    }
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  } catch {
    // e.g. background permission not granted, or no task was running to stop
  }
}

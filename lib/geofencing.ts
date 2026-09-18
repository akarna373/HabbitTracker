import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDb } from "./db";
import { findHotspots, HOTSPOT_RADIUS_METERS } from "./location";
import { scheduleHotspotDeterrentNotification } from "./notifications";
import type { SmokeLocation } from "./types";

export const GEOFENCE_TASK_NAME = "smoke-location-geofence";

// Android's geofencing is unreliable for small circles - Google recommends at
// least ~100-150 m, since it relies on Wi-Fi/cell positioning. The clustering
// radius (HOTSPOT_RADIUS_METERS, 75 m) stays as is; only the registered region
// is widened, so entering the spot's surroundings still raises the alert.
const GEOFENCE_RADIUS_METERS = 150;

// Defined at module scope (imported unconditionally from app/_layout.tsx) so
// Android can invoke it headlessly - with no app UI running - which means it
// can't rely on the Zustand store or any React context, only plain DB/module
// calls like getDb() and scheduleHotspotDeterrentNotification.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  if (eventType !== Location.GeofencingEventType.Enter || !region?.identifier) return;

  const [habitId] = region.identifier.split("::");
  if (!habitId) return;

  // Each region belongs to one habit, so this alerts only that habit, worded
  // for it, with its own action buttons. The shared cooldown inside
  // scheduleHotspotDeterrentNotification stops repeats (the OS re-fires Enter
  // while the user lingers, and overlapping regions fire together).
  const db = await getDb();
  const habit = await db.getFirstAsync<{ id: string; templateId: string; locationTrackingEnabled: number }>(
    "SELECT id, templateId, locationTrackingEnabled FROM habits WHERE id = ? AND archivedAt IS NULL",
    [habitId]
  );
  if (!habit || !habit.locationTrackingEnabled) return;

  await scheduleHotspotDeterrentNotification(habit.id, habit.templateId);
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
        radius: GEOFENCE_RADIUS_METERS,
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

import * as Location from "expo-location";

export interface Point {
  latitude: number;
  longitude: number;
}

// A cluster of 3+ logged points within 75m of each other counts as a "usual
// spot" - below that, a single one-off location (e.g. while travelling)
// never gets flagged as a hotspot.
export const HOTSPOT_RADIUS_METERS = 75;
export const HOTSPOT_MIN_VISITS = 3;

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export async function getCurrentLocation(): Promise<Point | null> {
  try {
    const granted = await ensureLocationPermission();
    if (!granted) return null;
    const position = await Location.getCurrentPositionAsync({});
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

const EARTH_RADIUS_METERS = 6371000;

export function distanceMeters(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function centroid(points: Point[]): Point {
  const latitude = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const longitude = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
  return { latitude, longitude };
}

// Simple greedy clustering: each unassigned point pulls in every other
// unassigned point within HOTSPOT_RADIUS_METERS of it, then the group
// becomes a hotspot if it has enough visits.
export function findHotspots(points: Point[]): Point[] {
  const remaining = [...points];
  const hotspots: Point[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (distanceMeters(seed, remaining[i]) <= HOTSPOT_RADIUS_METERS) {
        group.push(...remaining.splice(i, 1));
      }
    }
    if (group.length >= HOTSPOT_MIN_VISITS) {
      hotspots.push(centroid(group));
    }
  }

  return hotspots;
}

export function nearestHotspot(current: Point, hotspots: Point[]): Point | null {
  for (const hotspot of hotspots) {
    if (distanceMeters(current, hotspot) <= HOTSPOT_RADIUS_METERS) return hotspot;
  }
  return null;
}

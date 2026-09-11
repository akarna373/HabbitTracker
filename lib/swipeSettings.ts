import Storage from "expo-sqlite/kv-store";

const KEY = "swipeControls";

export interface SwipeSettings {
  deleteEnabled: boolean;
  archiveEnabled: boolean;
}

const DEFAULTS: SwipeSettings = { deleteEnabled: true, archiveEnabled: true };

export async function getSwipeSettings(): Promise<SwipeSettings> {
  const raw = await Storage.getItem(KEY);
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
}

export async function saveSwipeSettings(settings: SwipeSettings): Promise<void> {
  await Storage.setItem(KEY, JSON.stringify(settings));
}

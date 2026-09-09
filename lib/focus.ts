import Storage from "expo-sqlite/kv-store";

const KEY = "focusAreas";

export async function saveFocusAreas(areas: string[]): Promise<void> {
  await Storage.setItem(KEY, JSON.stringify(areas));
}

export async function getFocusAreas(): Promise<string[]> {
  const raw = await Storage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

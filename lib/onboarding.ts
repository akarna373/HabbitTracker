import Storage from "expo-sqlite/kv-store";

const KEY = "hasSeenOnboarding";

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await Storage.getItem(KEY)) === "true";
}

export async function markOnboardingSeen(): Promise<void> {
  await Storage.setItem(KEY, "true");
}

export async function resetOnboarding(): Promise<void> {
  await Storage.removeItem(KEY);
}

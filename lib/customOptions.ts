import Storage from "expo-sqlite/kv-store";

// User-typed "Custom" values for a tap-to-select field (e.g. Medication's
// dose unit) persist here, keyed by field, so they show up as real options
// next time instead of forcing a retype - same kv-store already used for
// onboarding's flag, just holding a JSON array per key here.
function storageKey(field: string): string {
  return `customOptions:${field}`;
}

export async function getCustomOptions(field: string): Promise<string[]> {
  const raw = await Storage.getItem(storageKey(field));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addCustomOption(field: string, value: string): Promise<string[]> {
  const trimmed = value.trim();
  if (!trimmed) return getCustomOptions(field);
  const existing = await getCustomOptions(field);
  if (existing.includes(trimmed)) return existing;
  const next = [...existing, trimmed];
  await Storage.setItem(storageKey(field), JSON.stringify(next));
  return next;
}

export async function removeCustomOption(field: string, value: string): Promise<string[]> {
  const existing = await getCustomOptions(field);
  const next = existing.filter((v) => v !== value);
  await Storage.setItem(storageKey(field), JSON.stringify(next));
  return next;
}

import Storage from "expo-sqlite/kv-store";

export type Gender = "female" | "male" | "unspecified";

export interface UserProfile {
  name: string;
  username: string;
  age: number | null;
  gender: Gender | null;
}

const KEY = "userProfile";

// Trims whitespace and strips any leading "@" so stored usernames are bare.
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await Storage.setItem(KEY, JSON.stringify(profile));
}

export async function getProfile(): Promise<UserProfile | null> {
  const raw = await Storage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

import Storage from "expo-sqlite/kv-store";
import {
  defaultSelection,
  parseStoredSelection,
  pickBackground,
  serializeSelection,
  SUMMARY_BACKGROUND_COUNT,
  type BackgroundSelection,
} from "./backgroundRotation";

// Persistence for the Summary card's background (see lib/backgroundRotation.ts
// for the rules). Same key-value store the other small settings use. Nothing
// here may throw: a storage failure just shows the default background.
const STORAGE_KEY = "summary-background";

export function saveSummaryBackground(selection: BackgroundSelection): void {
  try {
    Storage.setItemSync(STORAGE_KEY, serializeSelection(selection));
  } catch {
    // Not saved: the choice holds for this session; next launch starts from the default.
  }
}

// Startup: read the saved selection and reuse it while its three-day period lasts,
// otherwise pick and save a new one (the default on a first launch). Runs in the
// store's init(), never during a render, so its random pick can't change what a
// re-render shows.
export function loadSummaryBackground(today: string, random: () => number = Math.random): BackgroundSelection {
  let raw: string | null;
  try {
    raw = Storage.getItemSync(STORAGE_KEY);
  } catch {
    return defaultSelection(today);
  }
  const { selection, changed } = pickBackground({
    stored: parseStoredSelection(raw, SUMMARY_BACKGROUND_COUNT),
    today,
    count: SUMMARY_BACKGROUND_COUNT,
    random,
  });
  if (changed) saveSummaryBackground(selection);
  return selection;
}

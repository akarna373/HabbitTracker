// The tables every install starts with. Columns added after the first release are
// appended by the ALTER TABLE steps in lib/db.ts (CREATE TABLE IF NOT EXISTS never alters
// an existing table). Kept apart from lib/db.ts, which needs expo-sqlite, so the tests can
// build the same tables in an in-memory database.
export const BASE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  templateId TEXT NOT NULL,
  name TEXT NOT NULL,
  trackingMethod TEXT NOT NULL,
  targetAmount REAL,
  unit TEXT,
  reason TEXT,
  frequencyType TEXT NOT NULL,
  repeatDays TEXT NOT NULL,
  reminderEnabled INTEGER NOT NULL DEFAULT 0,
  reminderTime TEXT,
  reminderNotificationId TEXT,
  hasCost INTEGER NOT NULL DEFAULT 0,
  baselineQuantity REAL,
  pricePerItem REAL,
  goalType TEXT,
  summaryTime TEXT,
  summaryNotificationId TEXT,
  locationTrackingEnabled INTEGER NOT NULL DEFAULT 0,
  backgroundLocationEnabled INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  archivedAt TEXT
);
CREATE TABLE IF NOT EXISTS microtasks (
  id TEXT PRIMARY KEY NOT NULL,
  habitId TEXT NOT NULL,
  text TEXT NOT NULL,
  sortOrder INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY NOT NULL,
  habitId TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  amountB REAL,
  microtasksDone TEXT NOT NULL DEFAULT '[]',
  reflection TEXT,
  UNIQUE(habitId, date)
);
CREATE TABLE IF NOT EXISTS smoke_locations (
  id TEXT PRIMARY KEY NOT NULL,
  habitId TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  loggedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_settings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  monthlyGoal REAL,
  currencyCode TEXT NOT NULL DEFAULT 'NPR'
);
INSERT OR IGNORE INTO financial_settings (id, monthlyGoal, currencyCode) VALUES (1, NULL, 'NPR');
`;

import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("habittracker.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
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
      `);
      // CREATE TABLE IF NOT EXISTS never alters an already-existing table,
      // so a habits table created before locationTrackingEnabled existed is
      // missing the column - add it, ignoring the "duplicate column" error
      // on every install that already has it (fresh installs included).
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN locationTrackingEnabled INTEGER NOT NULL DEFAULT 0;");
      } catch {
        // column already exists
      }
      return db;
    });
  }
  return dbPromise;
}

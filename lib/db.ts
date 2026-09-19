import * as SQLite from "expo-sqlite";
import { BASE_TABLES_SQL } from "./schema";
import { migrateAmountLoggedColumn, SAVINGS_LEDGER_DDL } from "./savingsLedgerDb";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("habittracker.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        ${BASE_TABLES_SQL}
        ${SAVINGS_LEDGER_DDL}
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
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN backgroundLocationEnabled INTEGER NOT NULL DEFAULT 0;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN reduceDays INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN attendedCount INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN heldCount INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN attendanceTarget REAL;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN examDate TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN checkupIntervalDays INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE daily_logs ADD COLUMN amountB REAL;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN doseAmount REAL;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN doseUnit TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN dosageFrequency TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN durationType TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN medicineCategory TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN medicationNotificationIds TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN tabletsPerPacket INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN stockRemaining INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN lowStockNotifiedAt TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN medicationStartDate TEXT;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN totalTabletsBought INTEGER;");
      } catch {
        // column already exists
      }
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN pillColor TEXT;");
      } catch {
        // column already exists
      }
      // Marks which daily_logs amounts were recorded on purpose (see DailyLog in
      // lib/types.ts). Runs its one-time legacy fix-up only on the first launch after
      // the update; every later launch finds the column and does nothing.
      await migrateAmountLoggedColumn(db);
      return db;
    });
  }
  return dbPromise;
}

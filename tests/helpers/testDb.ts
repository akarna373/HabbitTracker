import { DatabaseSync } from "node:sqlite";
import { BASE_TABLES_SQL } from "../../lib/schema";
import { SAVINGS_LEDGER_DDL, type LedgerDb } from "../../lib/savingsLedgerDb";
import { localNoon } from "./fixtures";

// An in-memory SQLite database that answers the same calls as expo-sqlite's, using the
// app's real table definitions. It lets the tests run the app's actual SQL.

export interface TestDb extends LedgerDb {
  raw: DatabaseSync;
}

export function openTestDb(): TestDb {
  const raw = new DatabaseSync(":memory:");
  raw.exec(BASE_TABLES_SQL);
  raw.exec(SAVINGS_LEDGER_DDL);

  return {
    raw,
    async getAllAsync<T>(sql: string, params: unknown[]): Promise<T[]> {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async runAsync(sql: string, params: unknown[]): Promise<unknown> {
      return raw.prepare(sql).run(...(params as never[]));
    },
    async execAsync(sql: string): Promise<void> {
      raw.exec(sql);
    },
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

// Inserts a habit row (only the columns the tests need; the rest take their defaults).
export function insertHabit(
  db: TestDb,
  habit: {
    id: string;
    name?: string;
    kind?: string;
    hasCost?: boolean;
    baselineQuantity: number | null;
    pricePerItem: number | null;
    createdAt?: string;
    archivedAt?: string | null;
  }
): void {
  db.raw
    .prepare(
      `INSERT INTO habits (id, kind, category, templateId, name, trackingMethod, frequencyType, repeatDays,
                           hasCost, baselineQuantity, pricePerItem, createdAt, archivedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      habit.id,
      habit.kind ?? "quit",
      "quit",
      "smoking",
      habit.name ?? habit.id,
      "amount",
      "daily",
      "[0,1,2,3,4,5,6]",
      habit.hasCost === false ? 0 : 1,
      habit.baselineQuantity,
      habit.pricePerItem,
      habit.createdAt ?? localNoon("2026-08-01"),
      habit.archivedAt ?? null
    );
}

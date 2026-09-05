import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrateDbIfNeeded } from "@/lib/db";

/**
 * Wraps a better-sqlite3 in-memory database behind the small async subset
 * of expo-sqlite's `SQLiteDatabase` interface that lib/db.ts actually uses
 * (execAsync/getAllAsync/getFirstAsync/runAsync), so lib/db.ts can be
 * exercised against a real SQLite engine in plain Node/Jest without expo-sqlite
 * itself (which requires a native/Expo runtime).
 */
function wrap(raw: Database.Database): SQLiteDatabase {
  const adapter = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    getAllAsync: async <T,>(sql: string, ...params: unknown[]) => {
      return raw.prepare(sql).all(...params) as T[];
    },
    getFirstAsync: async <T,>(sql: string, ...params: unknown[]) => {
      const row = raw.prepare(sql).get(...params);
      return (row ?? null) as T | null;
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const info = raw.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

/** A fresh, migrated in-memory database for one test. */
export async function createTestDb(): Promise<SQLiteDatabase> {
  const raw = new Database(":memory:");
  const db = wrap(raw);
  await migrateDbIfNeeded(db);
  return db;
}

/** A fresh, unmigrated in-memory database, for testing `migrateDbIfNeeded` itself. */
export function createRawTestDb(): SQLiteDatabase {
  const raw = new Database(":memory:");
  return wrap(raw);
}

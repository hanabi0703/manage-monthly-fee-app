import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Manual jest mock for expo-sqlite, used by component tests. Screens only
 * ever call `useSQLiteContext()`; this lets a test point it at whichever
 * in-memory test database (see lib/__tests__/testDb.ts) it set up.
 */

let currentDb: SQLiteDatabase | null = null;

export function __setTestDb(db: SQLiteDatabase) {
  currentDb = db;
}

export function useSQLiteContext(): SQLiteDatabase {
  if (!currentDb) {
    throw new Error("__setTestDb(db) must be called before rendering a screen under test.");
  }
  return currentDb;
}

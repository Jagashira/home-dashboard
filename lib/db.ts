import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { APP_CONFIG } from "./config";

let dbInstance: BetterSqlite3.Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const absolutePath = path.isAbsolute(APP_CONFIG.databasePath)
    ? APP_CONFIG.databasePath
    : path.join(process.cwd(), APP_CONFIG.databasePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  dbInstance = new BetterSqlite3(absolutePath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  return dbInstance;
}


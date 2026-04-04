import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export interface QueryPage {
  id: string;
  name: string;
  database: string;
  query: string;
  view_type: string;
  created_at: string;
  updated_at: string;
}

export class DatabaseManager {
  private dataDir: string;
  private metaDb: Database.Database;
  private currentDb: Database.Database | null = null;
  private currentDbName: string | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    this.metaDb = new Database(path.join(dataDir, ".meta.db"));
    this.initMeta();
  }

  private initMeta() {
    this.metaDb.exec(`
      CREATE TABLE IF NOT EXISTS query_pages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        database TEXT NOT NULL,
        query TEXT NOT NULL,
        view_type TEXT NOT NULL DEFAULT 'table',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_query_pages_name_db
        ON query_pages (name, database);

      CREATE TABLE IF NOT EXISTS column_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        database TEXT NOT NULL,
        "table" TEXT NOT NULL,
        "column" TEXT NOT NULL,
        value TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#9B9A97',
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_column_options_unique
        ON column_options (database, "table", "column", value);

      CREATE TABLE IF NOT EXISTS column_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        database TEXT NOT NULL,
        "table" TEXT NOT NULL,
        column_name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_column_order_unique
        ON column_order (database, "table", column_name);
    `);
  }

  private dbPath(name: string): string {
    // Sanitize: only allow alphanumeric, dash, underscore, dot
    if (!/^[\w\-. ]+$/.test(name)) {
      throw new Error(`Invalid database name: "${name}"`);
    }
    return path.join(this.dataDir, `${name}.db`);
  }

  // ── Database management ──────────────────────────────────────────────────────

  listDatabases(): string[] {
    const entries = fs.readdirSync(this.dataDir);
    return entries
      .filter((f) => f.endsWith(".db") && f !== ".meta.db")
      .map((f) => f.slice(0, -3));
  }

  selectDatabase(name: string): void {
    if (this.currentDb && this.currentDbName !== name) {
      this.currentDb.close();
    }
    this.currentDb = new Database(this.dbPath(name));
    this.currentDbName = name;
    // Enable WAL for better concurrent read performance
    this.currentDb.pragma("journal_mode = WAL");
    this.currentDb.pragma("foreign_keys = ON");
  }

  createDatabase(name: string): void {
    const p = this.dbPath(name);
    if (fs.existsSync(p)) {
      throw new Error(`Database "${name}" already exists`);
    }
    const db = new Database(p);
    db.pragma("journal_mode = WAL");
    db.close();
  }

  deleteDatabase(name: string): void {
    const p = this.dbPath(name);
    if (!fs.existsSync(p)) {
      throw new Error(`Database "${name}" does not exist`);
    }
    if (this.currentDbName === name) {
      this.currentDb?.close();
      this.currentDb = null;
      this.currentDbName = null;
    }
    fs.unlinkSync(p);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getDb(): Database.Database {
    if (!this.currentDb) {
      throw new Error(
        "No database selected. Use `select_database` first."
      );
    }
    return this.currentDb;
  }

  getCurrentDbName(): string {
    if (!this.currentDbName) {
      throw new Error("No database selected. Use `select_database` first.");
    }
    return this.currentDbName;
  }

  // ── Schema management ────────────────────────────────────────────────────────

  listTables(): string[] {
    const db = this.getDb();
    const rows = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      )
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  describeTable(table: string): Record<string, unknown>[] {
    const db = this.getDb();
    return db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Record<string, unknown>[];
  }

  createTable(table: string, columns: ColumnDef[]): void {
    const db = this.getDb();
    const cols = columns
      .map((c) => {
        let def = `"${c.name}" ${c.type}`;
        if (c.primaryKey) def += " PRIMARY KEY";
        if (c.autoIncrement) def += " AUTOINCREMENT";
        if (c.notNull) def += " NOT NULL";
        if (c.unique) def += " UNIQUE";
        if (c.defaultValue !== undefined) def += ` DEFAULT ${c.defaultValue}`;
        return def;
      })
      .join(", ");
    db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${cols})`);
  }

  alterTable(table: string, operations: AlterOperation[]): void {
    const db = this.getDb();
    for (const op of operations) {
      switch (op.type) {
        case "add_column": {
          let def = `"${op.column}" ${op.columnType}`;
          if (op.notNull) def += " NOT NULL";
          if (op.defaultValue !== undefined) def += ` DEFAULT ${op.defaultValue}`;
          db.exec(`ALTER TABLE "${table}" ADD COLUMN ${def}`);
          break;
        }
        case "rename_column":
          db.exec(
            `ALTER TABLE "${table}" RENAME COLUMN "${op.column}" TO "${op.newName}"`
          );
          break;
        case "drop_column":
          db.exec(`ALTER TABLE "${table}" DROP COLUMN "${op.column}"`);
          break;
        case "rename_table":
          db.exec(`ALTER TABLE "${table}" RENAME TO "${op.newName}"`);
          break;
        default:
          throw new Error(`Unknown alter operation: ${(op as AlterOperation).type}`);
      }
    }
  }

  dropTable(table: string): void {
    const db = this.getDb();
    db.exec(`DROP TABLE IF EXISTS "${table}"`);
  }

  // ── Data CRUD ────────────────────────────────────────────────────────────────

  insertRows(table: string, rows: Record<string, unknown>[]): number {
    if (rows.length === 0) return 0;
    const db = this.getDb();
    const keys = Object.keys(rows[0]);
    const placeholders = keys.map(() => "?").join(", ");
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const stmt = db.prepare(
      `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`
    );
    const insert = db.transaction((rows: Record<string, unknown>[]) => {
      let count = 0;
      for (const row of rows) {
        stmt.run(keys.map((k) => row[k]));
        count++;
      }
      return count;
    });
    return insert(rows) as number;
  }

  updateRows(
    table: string,
    set: Record<string, unknown>,
    where: string,
    params: unknown[] = []
  ): number {
    const db = this.getDb();
    const setClauses = Object.keys(set)
      .map((k) => `"${k}" = ?`)
      .join(", ");
    const setValues = Object.values(set);
    const stmt = db.prepare(
      `UPDATE "${table}" SET ${setClauses} WHERE ${where}`
    );
    const result = stmt.run([...setValues, ...params]);
    return result.changes;
  }

  deleteRows(table: string, where: string, params: unknown[] = []): number {
    const db = this.getDb();
    const stmt = db.prepare(`DELETE FROM "${table}" WHERE ${where}`);
    const result = stmt.run(params);
    return result.changes;
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      return stmt.all(params) as T[];
    } else {
      const result = stmt.run(params);
      return [{ changes: result.changes, lastInsertRowid: result.lastInsertRowid }] as T[];
    }
  }

  // ── Query Pages ──────────────────────────────────────────────────────────────

  createQueryPage(
    name: string,
    query: string,
    viewType: string
  ): QueryPage {
    const dbName = this.getCurrentDbName();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const page: QueryPage = {
      id,
      name,
      database: dbName,
      query,
      view_type: viewType,
      created_at: now,
      updated_at: now,
    };
    this.metaDb
      .prepare(
        `INSERT INTO query_pages (id, name, database, query, view_type, created_at, updated_at)
         VALUES (@id, @name, @database, @query, @view_type, @created_at, @updated_at)`
      )
      .run(page);
    return page;
  }

  listQueryPages(): QueryPage[] {
    const dbName = this.getCurrentDbName();
    return this.metaDb
      .prepare(`SELECT * FROM query_pages WHERE database = ? ORDER BY name`)
      .all(dbName) as QueryPage[];
  }

  updateQueryPage(
    name: string,
    updates: Partial<Pick<QueryPage, "name" | "query" | "view_type">>
  ): QueryPage {
    const dbName = this.getCurrentDbName();
    const existing = this.metaDb
      .prepare(`SELECT * FROM query_pages WHERE name = ? AND database = ?`)
      .get(name, dbName) as QueryPage | undefined;
    if (!existing) {
      throw new Error(`Query page "${name}" not found in database "${dbName}"`);
    }
    const now = new Date().toISOString();
    const updated: QueryPage = {
      ...existing,
      ...updates,
      updated_at: now,
    };
    this.metaDb
      .prepare(
        `UPDATE query_pages SET name = @name, query = @query, view_type = @view_type, updated_at = @updated_at
         WHERE id = @id`
      )
      .run(updated);
    return updated;
  }

  deleteQueryPage(name: string): void {
    const dbName = this.getCurrentDbName();
    const result = this.metaDb
      .prepare(`DELETE FROM query_pages WHERE name = ? AND database = ?`)
      .run(name, dbName);
    if (result.changes === 0) {
      throw new Error(`Query page "${name}" not found in database "${dbName}"`);
    }
  }

  // ── Column Options (STATUS column values) ──────────────────────────────────

  getColumnOptions(table: string, column: string): ColumnOption[] {
    const dbName = this.getCurrentDbName();
    return this.metaDb
      .prepare(
        `SELECT value, color, sort_order FROM column_options
         WHERE database = ? AND "table" = ? AND "column" = ?
         ORDER BY sort_order, value`
      )
      .all(dbName, table, column) as ColumnOption[];
  }

  getAllColumnOptions(): Record<string, ColumnOption[]> {
    const dbName = this.getCurrentDbName();
    const rows = this.metaDb
      .prepare(
        `SELECT "table", "column", value, color, sort_order FROM column_options
         WHERE database = ?
         ORDER BY "table", "column", sort_order, value`
      )
      .all(dbName) as (ColumnOption & { table: string; column: string })[];

    const result: Record<string, ColumnOption[]> = {};
    for (const row of rows) {
      const key = `${row.table}.${row.column}`;
      if (!result[key]) result[key] = [];
      result[key].push({ value: row.value, color: row.color, sort_order: row.sort_order });
    }
    return result;
  }

  addColumnOption(table: string, column: string, value: string, color: string): void {
    const dbName = this.getCurrentDbName();
    // Get next sort order
    const maxRow = this.metaDb
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM column_options
         WHERE database = ? AND "table" = ? AND "column" = ?`
      )
      .get(dbName, table, column) as { max_sort: number };
    this.metaDb
      .prepare(
        `INSERT INTO column_options (database, "table", "column", value, color, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(dbName, table, column, value, color, maxRow.max_sort + 1);
  }

  removeColumnOption(table: string, column: string, value: string): void {
    const dbName = this.getCurrentDbName();
    const result = this.metaDb
      .prepare(
        `DELETE FROM column_options WHERE database = ? AND "table" = ? AND "column" = ? AND value = ?`
      )
      .run(dbName, table, column, value);
    if (result.changes === 0) {
      throw new Error(`Option "${value}" not found for ${table}.${column}`);
    }
  }

  // ── Column order ────────────────────────────────────────────────────────────

  getColumnOrder(table: string): string[] {
    const dbName = this.getCurrentDbName();
    const rows = this.metaDb
      .prepare(
        `SELECT column_name FROM column_order WHERE database = ? AND "table" = ? ORDER BY sort_order`
      )
      .all(dbName, table) as { column_name: string }[];
    return rows.map((r) => r.column_name);
  }

  setColumnOrder(table: string, columns: string[]): void {
    const dbName = this.getCurrentDbName();
    this.metaDb.prepare(`DELETE FROM column_order WHERE database = ? AND "table" = ?`).run(dbName, table);
    const insert = this.metaDb.prepare(
      `INSERT INTO column_order (database, "table", column_name, sort_order) VALUES (?, ?, ?, ?)`
    );
    const tx = this.metaDb.transaction(() => {
      for (let i = 0; i < columns.length; i++) {
        insert.run(dbName, table, columns[i], i);
      }
    });
    tx();
  }

  close() {
    this.currentDb?.close();
    this.metaDb.close();
  }
}

export interface ColumnDef {
  name: string;
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: string;
}

export interface ColumnOption {
  value: string;
  color: string;
  sort_order: number;
}

export type AlterOperation =
  | { type: "add_column"; column: string; columnType: string; notNull?: boolean; defaultValue?: string }
  | { type: "rename_column"; column: string; newName: string }
  | { type: "drop_column"; column: string }
  | { type: "rename_table"; newName: string };

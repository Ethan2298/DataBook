import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createTestManager } from "../helpers/setup.js";
import { DatabaseManager } from "../../src/database-manager.js";

let manager: DatabaseManager;
let tmpDir: string;
let cleanup: () => void;

beforeEach(() => {
  ({ manager, tmpDir, cleanup } = createTestManager());
});

afterEach(() => {
  cleanup();
});

describe("dbPath validation", () => {
  it("rejects empty string", () => {
    expect(() => manager.createDatabase("")).toThrow("Invalid database name");
  });

  it("rejects path traversal", () => {
    expect(() => manager.createDatabase("../evil")).toThrow(
      "Invalid database name"
    );
  });

  it("rejects special chars", () => {
    expect(() => manager.createDatabase("db;DROP")).toThrow(
      "Invalid database name"
    );
  });

  it("rejects slash characters", () => {
    expect(() => manager.createDatabase("foo/bar")).toThrow(
      "Invalid database name"
    );
  });

  it("accepts alphanumeric with dashes, underscores, dots, spaces", () => {
    expect(() => manager.createDatabase("my-db_v1.0 test")).not.toThrow();
  });
});

describe("createDatabase", () => {
  it("creates a .db file on disk", () => {
    manager.createDatabase("testdb");
    expect(fs.existsSync(path.join(tmpDir, "testdb.db"))).toBe(true);
  });

  it("throws on duplicate name", () => {
    manager.createDatabase("testdb");
    expect(() => manager.createDatabase("testdb")).toThrow("already exists");
  });

  it("throws on invalid name", () => {
    expect(() => manager.createDatabase("bad!name")).toThrow(
      "Invalid database name"
    );
  });
});

describe("listDatabases", () => {
  it("returns empty array initially", () => {
    expect(manager.listDatabases()).toEqual([]);
  });

  it("returns created databases", () => {
    manager.createDatabase("alpha");
    manager.createDatabase("beta");
    const dbs = manager.listDatabases();
    expect(dbs).toContain("alpha");
    expect(dbs).toContain("beta");
    expect(dbs).toHaveLength(2);
  });

  it("excludes .meta.db from results", () => {
    const dbs = manager.listDatabases();
    expect(dbs).not.toContain(".meta");
    expect(dbs).not.toContain(".meta.db");
  });
});

describe("selectDatabase", () => {
  it("selects and allows operations", () => {
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
    expect(manager.getCurrentDbName()).toBe("testdb");
    expect(() => manager.listTables()).not.toThrow();
  });

  it("closes previous db when switching", () => {
    manager.createDatabase("db1");
    manager.createDatabase("db2");
    manager.selectDatabase("db1");
    manager.selectDatabase("db2");
    expect(manager.getCurrentDbName()).toBe("db2");
  });

  it("throws on invalid name", () => {
    expect(() => manager.selectDatabase("bad!name")).toThrow(
      "Invalid database name"
    );
  });

  it("enables WAL and foreign keys", () => {
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
    const db = manager.getDb();
    const walMode = db.pragma("journal_mode", { simple: true });
    expect(walMode).toBe("wal");
    const fkEnabled = db.pragma("foreign_keys", { simple: true });
    expect(fkEnabled).toBe(1);
  });
});

describe("deleteDatabase", () => {
  it("removes file from disk", () => {
    manager.createDatabase("testdb");
    const dbPath = path.join(tmpDir, "testdb.db");
    expect(fs.existsSync(dbPath)).toBe(true);
    manager.deleteDatabase("testdb");
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it("throws if database does not exist", () => {
    expect(() => manager.deleteDatabase("nonexistent")).toThrow(
      "does not exist"
    );
  });

  it("clears current selection when deleting active database", () => {
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
    manager.deleteDatabase("testdb");
    expect(() => manager.getCurrentDbName()).toThrow("No database selected");
  });

  it("allows operations on other dbs after deleting active", () => {
    manager.createDatabase("db1");
    manager.createDatabase("db2");
    manager.selectDatabase("db1");
    manager.deleteDatabase("db1");
    manager.selectDatabase("db2");
    expect(manager.getCurrentDbName()).toBe("db2");
  });
});

describe("getDb / getCurrentDbName", () => {
  it("throws when no database selected", () => {
    expect(() => manager.getDb()).toThrow("No database selected");
    expect(() => manager.getCurrentDbName()).toThrow("No database selected");
  });

  it("returns db after selection", () => {
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
    expect(manager.getDb()).toBeDefined();
    expect(manager.getCurrentDbName()).toBe("testdb");
  });
});

describe("close", () => {
  it("closes cleanly without error", () => {
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
    expect(() => manager.close()).not.toThrow();
  });
});

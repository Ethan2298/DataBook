import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestManager } from "../helpers/setup.js";
import { DatabaseManager } from "../../src/database-manager.js";

let manager: DatabaseManager;
let cleanup: () => void;

beforeEach(() => {
  ({ manager, cleanup } = createTestManager());
  manager.createDatabase("testdb");
  manager.selectDatabase("testdb");
});

afterEach(() => {
  cleanup();
});

describe("listTables", () => {
  it("returns empty array on fresh database", () => {
    expect(manager.listTables()).toEqual([]);
  });

  it("returns created table names", () => {
    manager.createTable("users", [{ name: "id", type: "INTEGER" }]);
    manager.createTable("posts", [{ name: "id", type: "INTEGER" }]);
    const tables = manager.listTables();
    expect(tables).toContain("users");
    expect(tables).toContain("posts");
  });
});

describe("describeTable", () => {
  it("returns column metadata", () => {
    manager.createTable("users", [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "name", type: "TEXT", notNull: true },
    ]);
    const info = manager.describeTable("users");
    expect(info).toHaveLength(2);

    const idCol = info.find((c) => c["name"] === "id");
    expect(idCol).toBeDefined();
    expect(idCol!["type"]).toBe("INTEGER");
    expect(idCol!["pk"]).toBe(1);

    const nameCol = info.find((c) => c["name"] === "name");
    expect(nameCol).toBeDefined();
    expect(nameCol!["type"]).toBe("TEXT");
    expect(nameCol!["notnull"]).toBe(1);
  });

  it("returns empty array for non-existent table", () => {
    const info = manager.describeTable("nonexistent");
    expect(info).toEqual([]);
  });
});

describe("createTable", () => {
  it("creates table with basic columns", () => {
    manager.createTable("items", [
      { name: "id", type: "INTEGER" },
      { name: "title", type: "TEXT" },
    ]);
    expect(manager.listTables()).toContain("items");
    expect(manager.describeTable("items")).toHaveLength(2);
  });

  it("handles PRIMARY KEY + AUTOINCREMENT", () => {
    manager.createTable("items", [
      { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
      { name: "name", type: "TEXT" },
    ]);
    const info = manager.describeTable("items");
    const idCol = info.find((c) => c["name"] === "id");
    expect(idCol!["pk"]).toBe(1);
  });

  it("handles NOT NULL, UNIQUE, DEFAULT constraints", () => {
    manager.createTable("items", [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "status", type: "TEXT", notNull: true, defaultValue: "'active'" },
      { name: "code", type: "TEXT", unique: true },
    ]);
    const info = manager.describeTable("items");

    const status = info.find((c) => c["name"] === "status");
    expect(status!["notnull"]).toBe(1);
    expect(status!["dflt_value"]).toBe("'active'");

    // Verify UNIQUE is enforced by attempting duplicate insert
    manager.insertRows("items", [{ id: 1, status: "active", code: "ABC" }]);
    expect(() =>
      manager.insertRows("items", [{ id: 2, status: "active", code: "ABC" }])
    ).toThrow(); // UNIQUE constraint violation
  });

  it("uses IF NOT EXISTS (no error on duplicate call)", () => {
    manager.createTable("items", [{ name: "id", type: "INTEGER" }]);
    expect(() =>
      manager.createTable("items", [{ name: "id", type: "INTEGER" }])
    ).not.toThrow();
  });
});

describe("alterTable", () => {
  beforeEach(() => {
    manager.createTable("items", [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "name", type: "TEXT" },
    ]);
  });

  it("add_column: adds new column to existing table", () => {
    manager.alterTable("items", [
      { type: "add_column", column: "email", columnType: "TEXT" },
    ]);
    const info = manager.describeTable("items");
    expect(info.find((c) => c["name"] === "email")).toBeDefined();
  });

  it("add_column: with NOT NULL + DEFAULT", () => {
    manager.alterTable("items", [
      {
        type: "add_column",
        column: "status",
        columnType: "TEXT",
        notNull: true,
        defaultValue: "'pending'",
      },
    ]);
    const info = manager.describeTable("items");
    const status = info.find((c) => c["name"] === "status");
    expect(status!["notnull"]).toBe(1);
    expect(status!["dflt_value"]).toBe("'pending'");
  });

  it("rename_column: renames existing column", () => {
    manager.alterTable("items", [
      { type: "rename_column", column: "name", newName: "title" },
    ]);
    const info = manager.describeTable("items");
    expect(info.find((c) => c["name"] === "name")).toBeUndefined();
    expect(info.find((c) => c["name"] === "title")).toBeDefined();
  });

  it("drop_column: removes column", () => {
    manager.alterTable("items", [{ type: "drop_column", column: "name" }]);
    const info = manager.describeTable("items");
    expect(info.find((c) => c["name"] === "name")).toBeUndefined();
    expect(info).toHaveLength(1);
  });

  it("rename_table: renames table", () => {
    manager.alterTable("items", [
      { type: "rename_table", newName: "products" },
    ]);
    expect(manager.listTables()).toContain("products");
    expect(manager.listTables()).not.toContain("items");
  });

  it("multiple operations in sequence", () => {
    manager.alterTable("items", [
      { type: "add_column", column: "email", columnType: "TEXT" },
      { type: "rename_column", column: "name", newName: "title" },
    ]);
    const info = manager.describeTable("items");
    expect(info.find((c) => c["name"] === "email")).toBeDefined();
    expect(info.find((c) => c["name"] === "title")).toBeDefined();
    expect(info.find((c) => c["name"] === "name")).toBeUndefined();
  });

  it("throws on unknown operation type", () => {
    expect(() =>
      manager.alterTable("items", [
        { type: "unknown_op" } as any,
      ])
    ).toThrow("Unknown alter operation");
  });

  it("throws when adding duplicate column", () => {
    expect(() =>
      manager.alterTable("items", [
        { type: "add_column", column: "name", columnType: "TEXT" },
      ])
    ).toThrow(); // column "name" already exists
  });

  it("throws when dropping non-existent column", () => {
    expect(() =>
      manager.alterTable("items", [
        { type: "drop_column", column: "nonexistent" },
      ])
    ).toThrow();
  });

  it("throws when renaming non-existent column", () => {
    expect(() =>
      manager.alterTable("items", [
        { type: "rename_column", column: "nonexistent", newName: "other" },
      ])
    ).toThrow();
  });
});

describe("dropTable", () => {
  it("drops existing table", () => {
    manager.createTable("items", [{ name: "id", type: "INTEGER" }]);
    manager.dropTable("items");
    expect(manager.listTables()).not.toContain("items");
  });

  it("no error on non-existent table (IF EXISTS)", () => {
    expect(() => manager.dropTable("nonexistent")).not.toThrow();
  });
});

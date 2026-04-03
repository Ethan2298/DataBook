import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestManager } from "../helpers/setup.js";
import { DatabaseManager } from "../../src/database-manager.js";

let manager: DatabaseManager;
let cleanup: () => void;

beforeEach(() => {
  ({ manager, cleanup } = createTestManager());
  manager.createDatabase("testdb");
  manager.selectDatabase("testdb");
  manager.createTable("items", [
    { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
    { name: "name", type: "TEXT" },
    { name: "price", type: "REAL" },
  ]);
  manager.insertRows("items", [
    { name: "Widget", price: 9.99 },
    { name: "Gadget", price: 19.99 },
    { name: "Doohickey", price: 4.99 },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("query", () => {
  it("SELECT returns array of row objects", () => {
    const rows = manager.query("SELECT * FROM items") as any[];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveProperty("name");
    expect(rows[0]).toHaveProperty("price");
  });

  it("SELECT with params returns filtered results", () => {
    const rows = manager.query(
      "SELECT * FROM items WHERE price > ?",
      [10]
    ) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Gadget");
  });

  it("INSERT returns { changes, lastInsertRowid }", () => {
    const result = manager.query(
      "INSERT INTO items (name, price) VALUES (?, ?)",
      ["Thingamajig", 14.99]
    ) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].changes).toBe(1);
    expect(result[0].lastInsertRowid).toBeDefined();
  });

  it("UPDATE returns { changes }", () => {
    const result = manager.query(
      "UPDATE items SET price = ? WHERE name = ?",
      [11.99, "Widget"]
    ) as any[];
    expect(result[0].changes).toBe(1);
  });

  it("DELETE returns { changes }", () => {
    const result = manager.query(
      "DELETE FROM items WHERE name = ?",
      ["Doohickey"]
    ) as any[];
    expect(result[0].changes).toBe(1);
  });

  it("DDL (CREATE TABLE) works via query", () => {
    const result = manager.query(
      "CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, message TEXT)"
    ) as any[];
    expect(result[0].changes).toBe(0);
    expect(manager.listTables()).toContain("logs");
  });

  it("empty SELECT returns empty array", () => {
    const rows = manager.query(
      "SELECT * FROM items WHERE price > ?",
      [1000]
    );
    expect(rows).toEqual([]);
  });

  it("throws on invalid SQL", () => {
    expect(() => manager.query("NOT VALID SQL")).toThrow();
  });

  it("throws when no database selected", () => {
    const { manager: freshManager, cleanup: freshCleanup } = createTestManager();
    expect(() => freshManager.query("SELECT 1")).toThrow(
      "No database selected"
    );
    freshCleanup();
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestManager } from "../helpers/setup.js";
import { DatabaseManager } from "../../src/database-manager.js";

let manager: DatabaseManager;
let cleanup: () => void;

beforeEach(() => {
  ({ manager, cleanup } = createTestManager());
  manager.createDatabase("testdb");
  manager.selectDatabase("testdb");
  manager.createTable("users", [
    { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
    { name: "name", type: "TEXT", notNull: true },
    { name: "email", type: "TEXT", unique: true },
    { name: "age", type: "INTEGER" },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("insertRows", () => {
  it("inserts single row and returns count 1", () => {
    const count = manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
    ]);
    expect(count).toBe(1);
  });

  it("inserts multiple rows in transaction and returns correct count", () => {
    const count = manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
      { name: "Bob", email: "bob@test.com", age: 25 },
      { name: "Charlie", email: "charlie@test.com", age: 35 },
    ]);
    expect(count).toBe(3);
  });

  it("returns 0 for empty rows array", () => {
    const count = manager.insertRows("users", []);
    expect(count).toBe(0);
  });

  it("inserted data is queryable", () => {
    manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
    ]);
    const rows = manager.query("SELECT * FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe("Alice");
    expect(rows[0]["email"]).toBe("alice@test.com");
    expect(rows[0]["age"]).toBe(30);
  });

  it("throws when inserting into non-existent table", () => {
    expect(() =>
      manager.insertRows("nonexistent", [{ name: "Alice" }])
    ).toThrow("no such table");
  });

  it("handles various data types (text, integer, real, null)", () => {
    manager.createTable("mixed", [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "text_val", type: "TEXT" },
      { name: "int_val", type: "INTEGER" },
      { name: "real_val", type: "REAL" },
      { name: "null_val", type: "TEXT" },
    ]);
    manager.insertRows("mixed", [
      { id: 1, text_val: "hello", int_val: 42, real_val: 3.14, null_val: null },
    ]);
    const rows = manager.query("SELECT * FROM mixed");
    expect(rows[0]["text_val"]).toBe("hello");
    expect(rows[0]["int_val"]).toBe(42);
    expect(rows[0]["real_val"]).toBeCloseTo(3.14);
    expect(rows[0]["null_val"]).toBeNull();
  });
});

describe("updateRows", () => {
  beforeEach(() => {
    manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
      { name: "Bob", email: "bob@test.com", age: 25 },
    ]);
  });

  it("updates matching rows and returns change count", () => {
    const count = manager.updateRows(
      "users",
      { age: 31 },
      "name = ?",
      ["Alice"]
    );
    expect(count).toBe(1);
    const rows = manager.query(
      "SELECT age FROM users WHERE name = ?",
      ["Alice"]
    );
    expect(rows[0]["age"]).toBe(31);
  });

  it("returns 0 when no rows match WHERE", () => {
    const count = manager.updateRows(
      "users",
      { age: 99 },
      "name = ?",
      ["Nobody"]
    );
    expect(count).toBe(0);
  });

  it("supports parameterized WHERE clause", () => {
    const count = manager.updateRows(
      "users",
      { age: 50 },
      "age > ?",
      [26]
    );
    expect(count).toBe(1); // Only Alice (age 30) matches
  });

  it("updates multiple columns at once", () => {
    manager.updateRows(
      "users",
      { name: "Alicia", age: 31 },
      "email = ?",
      ["alice@test.com"]
    );
    const rows = manager.query(
      "SELECT * FROM users WHERE email = ?",
      ["alice@test.com"]
    );
    expect(rows[0]["name"]).toBe("Alicia");
    expect(rows[0]["age"]).toBe(31);
  });
});

describe("deleteRows", () => {
  beforeEach(() => {
    manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
      { name: "Bob", email: "bob@test.com", age: 25 },
    ]);
  });

  it("deletes matching rows and returns change count", () => {
    const count = manager.deleteRows("users", "name = ?", ["Alice"]);
    expect(count).toBe(1);
    const rows = manager.query("SELECT * FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe("Bob");
  });

  it("returns 0 when no rows match", () => {
    const count = manager.deleteRows("users", "name = ?", ["Nobody"]);
    expect(count).toBe(0);
  });

  it("supports parameterized WHERE clause", () => {
    const count = manager.deleteRows("users", "age < ?", [28]);
    expect(count).toBe(1); // Bob (age 25) deleted
    const rows = manager.query("SELECT * FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe("Alice");
  });
});

describe("CRUD integration", () => {
  it("insert -> update -> query -> delete -> verify empty", () => {
    manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
    ]);

    manager.updateRows("users", { name: "Alicia" }, "name = ?", ["Alice"]);

    const rows = manager.query("SELECT * FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe("Alicia");

    manager.deleteRows("users", "1 = 1");

    const remaining = manager.query("SELECT * FROM users");
    expect(remaining).toHaveLength(0);
  });

  it("transaction rollback on constraint violation", () => {
    manager.insertRows("users", [
      { name: "Alice", email: "alice@test.com", age: 30 },
    ]);

    // Try to insert batch where second row violates UNIQUE constraint on email
    expect(() =>
      manager.insertRows("users", [
        { name: "Bob", email: "bob@test.com", age: 25 },
        { name: "Charlie", email: "alice@test.com", age: 35 }, // duplicate email
      ])
    ).toThrow("UNIQUE constraint failed");

    // Transaction should have rolled back - only original Alice remains
    const rows = manager.query("SELECT * FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe("Alice");
  });
});

describe("SQL injection safety", () => {
  it("parameterized queries store malicious strings as data, not executed as SQL", () => {
    const malicious = "'; DROP TABLE users; --";
    manager.insertRows("users", [
      { name: malicious, email: "hacker@test.com", age: 1 },
    ]);

    // Table still exists and has exactly one row
    const tables = manager.listTables();
    expect(tables).toContain("users");

    const rows = manager.query("SELECT * FROM users WHERE email = ?", [
      "hacker@test.com",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["name"]).toBe(malicious);
  });
});

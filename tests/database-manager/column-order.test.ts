import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestManager } from "../helpers/setup.js";
import { DatabaseManager } from "../../src/database-manager.js";

let manager: DatabaseManager;
let cleanup: () => void;

beforeEach(() => {
  ({ manager, cleanup } = createTestManager());
  manager.createDatabase("testdb");
  manager.selectDatabase("testdb");
  manager.createTable("tasks", [
    { name: "id", type: "INTEGER", primaryKey: true },
    { name: "title", type: "TEXT" },
    { name: "status", type: "TEXT" },
    { name: "priority", type: "TEXT" },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("getColumnOrder", () => {
  it("returns empty array when no custom order set", () => {
    expect(manager.getColumnOrder("tasks")).toEqual([]);
  });

  it("returns columns in set order", () => {
    manager.setColumnOrder("tasks", ["status", "title", "priority", "id"]);
    expect(manager.getColumnOrder("tasks")).toEqual([
      "status",
      "title",
      "priority",
      "id",
    ]);
  });
});

describe("setColumnOrder", () => {
  it("persists column order", () => {
    manager.setColumnOrder("tasks", ["priority", "status", "title"]);
    const order = manager.getColumnOrder("tasks");
    expect(order).toEqual(["priority", "status", "title"]);
  });

  it("replaces previous order atomically", () => {
    manager.setColumnOrder("tasks", ["title", "status", "priority"]);
    manager.setColumnOrder("tasks", ["priority", "title", "status"]);
    const order = manager.getColumnOrder("tasks");
    expect(order).toEqual(["priority", "title", "status"]);
  });

  it("handles reordering (same columns, different order)", () => {
    manager.setColumnOrder("tasks", ["id", "title", "status", "priority"]);
    manager.setColumnOrder("tasks", ["priority", "status", "title", "id"]);
    expect(manager.getColumnOrder("tasks")).toEqual([
      "priority",
      "status",
      "title",
      "id",
    ]);
  });

  it("setColumnOrder with empty array clears the order", () => {
    manager.setColumnOrder("tasks", ["title", "status"]);
    manager.setColumnOrder("tasks", []);
    expect(manager.getColumnOrder("tasks")).toEqual([]);
  });

  it("accepts column names that do not exist in the table schema", () => {
    // setColumnOrder does not validate against actual table columns
    manager.setColumnOrder("tasks", ["nonexistent", "also_fake"]);
    expect(manager.getColumnOrder("tasks")).toEqual([
      "nonexistent",
      "also_fake",
    ]);
  });
});

describe("cross-database isolation", () => {
  it("column order in db A not visible when db B is selected", () => {
    manager.setColumnOrder("tasks", ["status", "title", "priority"]);

    manager.createDatabase("db2");
    manager.selectDatabase("db2");
    expect(manager.getColumnOrder("tasks")).toEqual([]);
  });
});

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

describe("addColumnOption", () => {
  it("adds option with color and auto-incremented sort_order", () => {
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    manager.addColumnOption("tasks", "status", "Done", "#4DAB6F");

    const options = manager.getColumnOptions("tasks", "status");
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe("Todo");
    expect(options[0].color).toBe("#E03E3E");
    expect(options[0].sort_order).toBe(0);
    expect(options[1].value).toBe("Done");
    expect(options[1].sort_order).toBe(1);
  });

  it("throws on duplicate (same table.column.value)", () => {
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    expect(() =>
      manager.addColumnOption("tasks", "status", "Todo", "#2383E2")
    ).toThrow("UNIQUE constraint failed");
  });
});

describe("getColumnOptions", () => {
  it("returns empty array when none exist", () => {
    expect(manager.getColumnOptions("tasks", "status")).toEqual([]);
  });

  it("returns options ordered by sort_order then value", () => {
    manager.addColumnOption("tasks", "status", "In Progress", "#2383E2");
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    manager.addColumnOption("tasks", "status", "Done", "#4DAB6F");

    const options = manager.getColumnOptions("tasks", "status");
    expect(options.map((o) => o.value)).toEqual([
      "In Progress",
      "Todo",
      "Done",
    ]);
  });

  it("scoped to current database", () => {
    manager.addColumnOption("tasks", "status", "Active", "#4DAB6F");

    manager.createDatabase("otherdb");
    manager.selectDatabase("otherdb");
    expect(manager.getColumnOptions("tasks", "status")).toEqual([]);
  });
});

describe("getAllColumnOptions", () => {
  it("returns empty object when none exist", () => {
    expect(manager.getAllColumnOptions()).toEqual({});
  });

  it("groups by 'table.column' key", () => {
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    manager.addColumnOption("tasks", "priority", "High", "#E03E3E");

    const all = manager.getAllColumnOptions();
    expect(Object.keys(all)).toContain("tasks.status");
    expect(Object.keys(all)).toContain("tasks.priority");
    expect(all["tasks.status"]).toHaveLength(1);
    expect(all["tasks.priority"]).toHaveLength(1);
  });

  it("includes options from multiple tables/columns", () => {
    manager.createTable("bugs", [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "severity", type: "TEXT" },
    ]);
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    manager.addColumnOption("bugs", "severity", "Critical", "#E03E3E");

    const all = manager.getAllColumnOptions();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all["tasks.status"][0].value).toBe("Todo");
    expect(all["bugs.severity"][0].value).toBe("Critical");
  });
});

describe("removeColumnOption", () => {
  it("removes existing option", () => {
    manager.addColumnOption("tasks", "status", "Todo", "#E03E3E");
    manager.addColumnOption("tasks", "status", "Done", "#4DAB6F");
    manager.removeColumnOption("tasks", "status", "Todo");

    const options = manager.getColumnOptions("tasks", "status");
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe("Done");
  });

  it("throws when option not found", () => {
    expect(() =>
      manager.removeColumnOption("tasks", "status", "Nonexistent")
    ).toThrow('Option "Nonexistent" not found');
  });

  it("new option after removal gets next sort_order based on MAX", () => {
    manager.addColumnOption("tasks", "status", "A", "#111"); // sort_order 0
    manager.addColumnOption("tasks", "status", "B", "#222"); // sort_order 1
    manager.addColumnOption("tasks", "status", "C", "#333"); // sort_order 2
    manager.removeColumnOption("tasks", "status", "B");      // remove middle
    manager.addColumnOption("tasks", "status", "D", "#444"); // should get sort_order 3

    const options = manager.getColumnOptions("tasks", "status");
    const d = options.find((o) => o.value === "D");
    expect(d).toBeDefined();
    expect(d!.sort_order).toBe(3);
  });
});

describe("cross-database isolation", () => {
  it("options in db A not visible when db B is selected", () => {
    manager.addColumnOption("tasks", "status", "Active", "#4DAB6F");

    manager.createDatabase("db2");
    manager.selectDatabase("db2");
    expect(manager.getAllColumnOptions()).toEqual({});
  });
});

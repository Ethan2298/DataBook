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
    { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
    { name: "title", type: "TEXT", notNull: true },
    { name: "status", type: "TEXT" },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("row history tracking", () => {
  it("records history for insert", () => {
    manager.insertRows("tasks", [{ title: "Buy groceries", status: "todo" }]);
    const history = manager.getTableHistory("tasks");
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("insert");
    expect(history[0].row_pk).toBe("1");
    expect(history[0].old_data).toBeNull();
    expect(history[0].new_data).toMatchObject({ title: "Buy groceries", status: "todo" });
  });

  it("records history for update", () => {
    manager.insertRows("tasks", [{ title: "Buy groceries", status: "todo" }]);
    manager.updateRows("tasks", { status: "done" }, "id = ?", [1]);
    const history = manager.getTableHistory("tasks");
    expect(history).toHaveLength(2);
    // Most recent first
    expect(history[0].action).toBe("update");
    expect(history[0].old_data).toMatchObject({ status: "todo" });
    expect(history[0].new_data).toMatchObject({ status: "done" });
  });

  it("records history for delete", () => {
    manager.insertRows("tasks", [{ title: "Buy groceries", status: "todo" }]);
    manager.deleteRows("tasks", "id = ?", [1]);
    const history = manager.getTableHistory("tasks");
    expect(history).toHaveLength(2);
    expect(history[0].action).toBe("delete");
    expect(history[0].old_data).toMatchObject({ title: "Buy groceries" });
    expect(history[0].new_data).toBeNull();
  });

  it("tracks multiple inserts separately", () => {
    manager.insertRows("tasks", [
      { title: "Task 1", status: "todo" },
      { title: "Task 2", status: "todo" },
    ]);
    const history = manager.getTableHistory("tasks");
    expect(history).toHaveLength(2);
  });

  it("filters history by row pk", () => {
    manager.insertRows("tasks", [{ title: "Task 1", status: "todo" }]);
    manager.insertRows("tasks", [{ title: "Task 2", status: "todo" }]);
    manager.updateRows("tasks", { status: "done" }, "id = ?", [1]);

    const row1History = manager.getRowHistory("tasks", "1");
    expect(row1History).toHaveLength(2); // insert + update
    expect(row1History[0].action).toBe("update");
    expect(row1History[1].action).toBe("insert");

    const row2History = manager.getRowHistory("tasks", "2");
    expect(row2History).toHaveLength(1); // just insert
  });

  it("respects limit and offset for table history", () => {
    manager.insertRows("tasks", [{ title: "Task 1", status: "todo" }]);
    manager.insertRows("tasks", [{ title: "Task 2", status: "todo" }]);
    manager.insertRows("tasks", [{ title: "Task 3", status: "todo" }]);

    const limited = manager.getTableHistory("tasks", 2, 0);
    expect(limited).toHaveLength(2);

    const offset = manager.getTableHistory("tasks", 2, 2);
    expect(offset).toHaveLength(1);
  });
});

describe("revertChange", () => {
  it("reverts an insert by deleting the row", () => {
    manager.insertRows("tasks", [{ title: "To delete", status: "todo" }]);
    const history = manager.getTableHistory("tasks");
    const insertEntry = history[0];

    const result = manager.revertChange(insertEntry.id);
    expect(result.action).toBe("delete");

    const rows = manager.query("SELECT * FROM tasks");
    expect(rows).toHaveLength(0);
  });

  it("reverts an update by restoring old data", () => {
    manager.insertRows("tasks", [{ title: "Original", status: "todo" }]);
    manager.updateRows("tasks", { title: "Changed", status: "done" }, "id = ?", [1]);
    const history = manager.getTableHistory("tasks");
    const updateEntry = history[0];

    const result = manager.revertChange(updateEntry.id);
    expect(result.action).toBe("update");

    const rows = manager.query("SELECT * FROM tasks WHERE id = 1") as Record<string, unknown>[];
    expect(rows[0].title).toBe("Original");
    expect(rows[0].status).toBe("todo");
  });

  it("reverts a delete by re-inserting the row", () => {
    manager.insertRows("tasks", [{ title: "Will restore", status: "todo" }]);
    manager.deleteRows("tasks", "id = ?", [1]);
    const history = manager.getTableHistory("tasks");
    const deleteEntry = history[0];

    const result = manager.revertChange(deleteEntry.id);
    expect(result.action).toBe("insert");

    const rows = manager.query("SELECT * FROM tasks") as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Will restore");
  });

  it("throws on invalid history id", () => {
    expect(() => manager.revertChange(9999)).toThrow("History entry 9999 not found");
  });

  it("revert itself is tracked in history", () => {
    manager.insertRows("tasks", [{ title: "Track me", status: "todo" }]);
    manager.updateRows("tasks", { status: "done" }, "id = ?", [1]);

    const history = manager.getTableHistory("tasks");
    manager.revertChange(history[0].id); // revert the update

    // Should now have 4 entries: insert, update, revert-update (which is another update)
    const afterHistory = manager.getTableHistory("tasks");
    expect(afterHistory.length).toBeGreaterThanOrEqual(3);
  });
});

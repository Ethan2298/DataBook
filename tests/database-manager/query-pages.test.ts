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

describe("createQueryPage", () => {
  it("creates page with generated ID and timestamps", () => {
    const page = manager.createQueryPage(
      "All Users",
      "SELECT * FROM users",
      "table"
    );
    expect(page.id).toBeTruthy();
    expect(page.name).toBe("All Users");
    expect(page.query).toBe("SELECT * FROM users");
    expect(page.view_type).toBe("table");
    expect(page.database).toBe("testdb");
    expect(page.created_at).toBeTruthy();
    expect(page.updated_at).toBeTruthy();
    expect(page.created_at).toBe(page.updated_at);
  });

  it("page is scoped to current database", () => {
    const page = manager.createQueryPage(
      "Test",
      "SELECT 1",
      "table"
    );
    expect(page.database).toBe("testdb");
  });

  it("throws when no database selected", () => {
    const { manager: freshManager, cleanup: freshCleanup } = createTestManager();
    expect(() =>
      freshManager.createQueryPage("Test", "SELECT 1", "table")
    ).toThrow("No database selected");
    freshCleanup();
  });
});

describe("listQueryPages", () => {
  it("returns empty array when none exist", () => {
    expect(manager.listQueryPages()).toEqual([]);
  });

  it("returns pages for current database only", () => {
    manager.createQueryPage("Page A", "SELECT 1", "table");

    // Switch to different database
    manager.createDatabase("otherdb");
    manager.selectDatabase("otherdb");
    manager.createQueryPage("Page B", "SELECT 2", "kanban");

    // Only Page B should be visible in otherdb
    const pages = manager.listQueryPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("Page B");

    // Switch back - only Page A visible
    manager.selectDatabase("testdb");
    const testPages = manager.listQueryPages();
    expect(testPages).toHaveLength(1);
    expect(testPages[0].name).toBe("Page A");
  });

  it("ordered by name", () => {
    manager.createQueryPage("Zebra", "SELECT 1", "table");
    manager.createQueryPage("Alpha", "SELECT 2", "table");
    manager.createQueryPage("Middle", "SELECT 3", "table");
    const pages = manager.listQueryPages();
    expect(pages.map((p) => p.name)).toEqual(["Alpha", "Middle", "Zebra"]);
  });
});

describe("updateQueryPage", () => {
  beforeEach(() => {
    manager.createQueryPage("Test Page", "SELECT * FROM users", "table");
  });

  it("updates name", () => {
    const updated = manager.updateQueryPage("Test Page", {
      name: "Renamed Page",
    });
    expect(updated.name).toBe("Renamed Page");
  });

  it("updates query", () => {
    const updated = manager.updateQueryPage("Test Page", {
      query: "SELECT id FROM users",
    });
    expect(updated.query).toBe("SELECT id FROM users");
  });

  it("updates view_type", () => {
    const updated = manager.updateQueryPage("Test Page", {
      view_type: "kanban",
    });
    expect(updated.view_type).toBe("kanban");
  });

  it("updates multiple fields at once", () => {
    const updated = manager.updateQueryPage("Test Page", {
      name: "New Name",
      query: "SELECT 1",
      view_type: "calendar",
    });
    expect(updated.name).toBe("New Name");
    expect(updated.query).toBe("SELECT 1");
    expect(updated.view_type).toBe("calendar");
  });

  it("preserves fields not in updates", () => {
    const original = manager.listQueryPages()[0];
    const updated = manager.updateQueryPage("Test Page", {
      name: "New Name",
    });
    expect(updated.query).toBe(original.query);
    expect(updated.view_type).toBe(original.view_type);
    expect(updated.id).toBe(original.id);
    expect(updated.created_at).toBe(original.created_at);
  });

  it("updates updated_at timestamp", () => {
    const original = manager.listQueryPages()[0];
    // Small delay to ensure timestamp difference
    const updated = manager.updateQueryPage("Test Page", {
      name: "Updated",
    });
    expect(updated.updated_at).not.toBe(original.updated_at);
  });

  it("throws for non-existent page name", () => {
    expect(() =>
      manager.updateQueryPage("Nonexistent", { name: "X" })
    ).toThrow('Query page "Nonexistent" not found');
  });
});

describe("deleteQueryPage", () => {
  it("deletes existing page", () => {
    manager.createQueryPage("To Delete", "SELECT 1", "table");
    manager.deleteQueryPage("To Delete");
    expect(manager.listQueryPages()).toHaveLength(0);
  });

  it("throws for non-existent page name", () => {
    expect(() => manager.deleteQueryPage("Nonexistent")).toThrow(
      'Query page "Nonexistent" not found'
    );
  });
});

describe("cross-database isolation", () => {
  it("query pages in db A not visible when db B is selected", () => {
    manager.createQueryPage("DB1 Page", "SELECT 1", "table");
    manager.createDatabase("db2");
    manager.selectDatabase("db2");
    expect(manager.listQueryPages()).toHaveLength(0);
  });
});

#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import os from "node:os";
import { DatabaseManager } from "./database-manager.js";

// Data directory — override with DATABOOK_DIR env var
const DATA_DIR =
  process.env.DATABOOK_DIR ?? path.join(os.homedir(), ".databook");

const manager = new DatabaseManager(DATA_DIR);

const server = new McpServer({
  name: "DataBook",
  version: "0.1.0",
});

// ── Database Management ──────────────────────────────────────────────────────

server.tool("list_databases", "List all available DataBook databases", {}, () => {
  const dbs = manager.listDatabases();
  return {
    content: [
      {
        type: "text",
        text:
          dbs.length === 0
            ? "No databases found. Use `create_database` to create one."
            : `Databases (${dbs.length}):\n${dbs.map((d) => `  • ${d}`).join("\n")}`,
      },
    ],
  };
});

server.tool(
  "select_database",
  "Select a database to work with. All subsequent schema, data, and query page operations apply to this database.",
  { name: z.string().describe("Database name to select") },
  ({ name }) => {
    manager.selectDatabase(name);
    return {
      content: [{ type: "text", text: `Selected database: "${name}"` }],
    };
  }
);

server.tool(
  "create_database",
  "Create a new empty database",
  { name: z.string().describe("Name for the new database") },
  ({ name }) => {
    manager.createDatabase(name);
    return {
      content: [
        {
          type: "text",
          text: `Created database "${name}". Use \`select_database\` to start working with it.`,
        },
      ],
    };
  }
);

server.tool(
  "delete_database",
  "Permanently delete a database and all its data",
  { name: z.string().describe("Name of the database to delete") },
  ({ name }) => {
    manager.deleteDatabase(name);
    return {
      content: [{ type: "text", text: `Deleted database "${name}".` }],
    };
  }
);

// ── Schema Management ────────────────────────────────────────────────────────

server.tool("list_tables", "List all tables in the selected database", {}, () => {
  const tables = manager.listTables();
  return {
    content: [
      {
        type: "text",
        text:
          tables.length === 0
            ? "No tables found. Use `create_table` to create one."
            : `Tables (${tables.length}):\n${tables.map((t) => `  • ${t}`).join("\n")}`,
      },
    ],
  };
});

server.tool(
  "describe_table",
  "Show the schema (columns, types, constraints) of a table",
  { table: z.string().describe("Table name") },
  ({ table }) => {
    const info = manager.describeTable(table);
    const lines = info.map(
      (col) =>
        `  ${col["name"]} ${col["type"]}${col["notnull"] ? " NOT NULL" : ""}${col["pk"] ? " PRIMARY KEY" : ""}${col["dflt_value"] != null ? ` DEFAULT ${col["dflt_value"]}` : ""}`
    );
    return {
      content: [
        {
          type: "text",
          text:
            lines.length === 0
              ? `Table "${table}" has no columns or does not exist.`
              : `Table "${table}":\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

const ColumnDefSchema = z.object({
  name: z.string().describe("Column name"),
  type: z
    .string()
    .describe("SQLite type: TEXT, INTEGER, REAL, BLOB, NUMERIC, BOOLEAN (renders as checkbox in DataBook UI)"),
  primaryKey: z.boolean().optional().describe("Mark as PRIMARY KEY"),
  autoIncrement: z.boolean().optional().describe("Enable AUTOINCREMENT (requires INTEGER PRIMARY KEY)"),
  notNull: z.boolean().optional().describe("Add NOT NULL constraint"),
  unique: z.boolean().optional().describe("Add UNIQUE constraint"),
  defaultValue: z.string().optional().describe("SQL default value expression, e.g. '0' or \"'unknown'\""),
});

server.tool(
  "create_table",
  "Create a new table in the selected database",
  {
    table: z.string().describe("Table name"),
    columns: z.array(ColumnDefSchema).min(1).describe("Column definitions"),
  },
  ({ table, columns }) => {
    manager.createTable(table, columns);
    return {
      content: [
        {
          type: "text",
          text: `Created table "${table}" with columns: ${columns.map((c) => c.name).join(", ")}`,
        },
      ],
    };
  }
);

const AlterOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_column"),
    column: z.string().describe("New column name"),
    columnType: z.string().describe("SQLite type for the new column"),
    notNull: z.boolean().optional(),
    defaultValue: z.string().optional().describe("Default value expression"),
  }),
  z.object({
    type: z.literal("rename_column"),
    column: z.string().describe("Existing column name"),
    newName: z.string().describe("New column name"),
  }),
  z.object({
    type: z.literal("drop_column"),
    column: z.string().describe("Column to drop"),
  }),
  z.object({
    type: z.literal("rename_table"),
    newName: z.string().describe("New table name"),
  }),
]);

server.tool(
  "alter_table",
  "Modify a table structure: add/rename/drop columns, or rename the table",
  {
    table: z.string().describe("Table name to alter"),
    operations: z
      .array(AlterOperationSchema)
      .min(1)
      .describe("List of alter operations to apply in order"),
  },
  ({ table, operations }) => {
    manager.alterTable(table, operations);
    const summary = operations
      .map((op) => {
        switch (op.type) {
          case "add_column":
            return `added column "${op.column}" (${op.columnType})`;
          case "rename_column":
            return `renamed "${op.column}" → "${op.newName}"`;
          case "drop_column":
            return `dropped column "${op.column}"`;
          case "rename_table":
            return `renamed table to "${op.newName}"`;
        }
      })
      .join(", ");
    return {
      content: [{ type: "text", text: `Altered table "${table}": ${summary}` }],
    };
  }
);

server.tool(
  "drop_table",
  "Delete a table and all its data from the selected database",
  { table: z.string().describe("Table name to drop") },
  ({ table }) => {
    manager.dropTable(table);
    return {
      content: [{ type: "text", text: `Dropped table "${table}".` }],
    };
  }
);

// ── Data CRUD ────────────────────────────────────────────────────────────────

server.tool(
  "insert_rows",
  "Insert one or more rows into a table",
  {
    table: z.string().describe("Table name"),
    rows: z
      .array(z.record(z.unknown()))
      .min(1)
      .describe("Array of row objects. All rows should have the same keys."),
  },
  ({ table, rows }) => {
    const count = manager.insertRows(table, rows);
    return {
      content: [
        { type: "text", text: `Inserted ${count} row(s) into "${table}".` },
      ],
    };
  }
);

server.tool(
  "update_rows",
  "Update rows in a table that match a WHERE condition",
  {
    table: z.string().describe("Table name"),
    set: z
      .record(z.unknown())
      .describe("Key-value pairs of columns to update"),
    where: z
      .string()
      .describe(
        "SQL WHERE clause (without the WHERE keyword), e.g. \"id = ?\" or \"status = 'active'\""
      ),
    params: z
      .array(z.unknown())
      .optional()
      .describe("Positional parameters for ? placeholders in the where clause"),
  },
  ({ table, set, where, params }) => {
    const count = manager.updateRows(table, set, where, params ?? []);
    return {
      content: [
        { type: "text", text: `Updated ${count} row(s) in "${table}".` },
      ],
    };
  }
);

server.tool(
  "delete_rows",
  "Delete rows from a table that match a WHERE condition",
  {
    table: z.string().describe("Table name"),
    where: z
      .string()
      .describe(
        "SQL WHERE clause (without the WHERE keyword), e.g. \"id = ?\" or \"archived = 1\""
      ),
    params: z
      .array(z.unknown())
      .optional()
      .describe("Positional parameters for ? placeholders in the where clause"),
  },
  ({ table, where, params }) => {
    const count = manager.deleteRows(table, where, params ?? []);
    return {
      content: [
        { type: "text", text: `Deleted ${count} row(s) from "${table}".` },
      ],
    };
  }
);

// ── Query ────────────────────────────────────────────────────────────────────

server.tool(
  "query",
  "Execute a raw SQL statement and return results. Supports SELECT, INSERT, UPDATE, DELETE, and DDL.",
  {
    sql: z.string().describe("SQL statement to execute"),
    params: z
      .array(z.unknown())
      .optional()
      .describe("Positional parameters for ? placeholders"),
  },
  ({ sql, params }) => {
    const results = manager.query(sql, params ?? []);
    const text =
      results.length === 0
        ? "Query returned no results."
        : JSON.stringify(results, null, 2);
    return {
      content: [{ type: "text", text }],
    };
  }
);

// ── Query Pages ──────────────────────────────────────────────────────────────

const VIEW_TYPES = [
  "table",
  "kanban",
  "calendar",
  "gallery",
  "list",
  "timeline",
  "chart",
] as const;

server.tool(
  "create_query_page",
  "Save a named SQL query as a page with a specified view type. Query pages are bookmarks for commonly-used queries with associated display preferences.",
  {
    name: z.string().describe("Unique name for this query page"),
    query: z.string().describe("SQL SELECT query to save"),
    view_type: z
      .enum(VIEW_TYPES)
      .default("table")
      .describe("How results should be displayed: table, kanban, calendar, gallery, list, timeline, or chart"),
  },
  ({ name, query, view_type }) => {
    const page = manager.createQueryPage(name, query, view_type);
    return {
      content: [
        {
          type: "text",
          text: `Created query page "${page.name}" (view: ${page.view_type})\nID: ${page.id}`,
        },
      ],
    };
  }
);

server.tool(
  "list_query_pages",
  "List all saved query pages for the selected database",
  {},
  () => {
    const pages = manager.listQueryPages();
    if (pages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No query pages saved. Use `create_query_page` to save a query.",
          },
        ],
      };
    }
    const lines = pages.map(
      (p) => `  • ${p.name} [${p.view_type}]\n    ${p.query}`
    );
    return {
      content: [
        {
          type: "text",
          text: `Query pages (${pages.length}):\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "update_query_page",
  "Update a saved query page — rename it, change its SQL query, or change its view type",
  {
    name: z.string().describe("Current name of the query page to update"),
    new_name: z.string().optional().describe("New name for the page"),
    query: z.string().optional().describe("New SQL query"),
    view_type: z.enum(VIEW_TYPES).optional().describe("New view type"),
  },
  ({ name, new_name, query, view_type }) => {
    const updates: Record<string, string> = {};
    if (new_name) updates["name"] = new_name;
    if (query) updates["query"] = query;
    if (view_type) updates["view_type"] = view_type;

    if (Object.keys(updates).length === 0) {
      return {
        content: [{ type: "text", text: "No updates specified." }],
      };
    }

    const updated = manager.updateQueryPage(name, updates);
    return {
      content: [
        {
          type: "text",
          text: `Updated query page "${updated.name}" (view: ${updated.view_type})`,
        },
      ],
    };
  }
);

server.tool(
  "delete_query_page",
  "Delete a saved query page",
  { name: z.string().describe("Name of the query page to delete") },
  ({ name }) => {
    manager.deleteQueryPage(name);
    return {
      content: [{ type: "text", text: `Deleted query page "${name}".` }],
    };
  }
);

// ── Column Options (Status Tags) ─────────────────────────────────────────────

server.tool(
  "add_column_option",
  "Add a status/select option to a STATUS column. These options define the allowed values shown as colored tags in the DataBook UI.",
  {
    table: z.string().describe("Table name"),
    column: z.string().describe("Column name (must be a STATUS type column)"),
    value: z.string().describe("Option value/label"),
    color: z
      .string()
      .default("#9B9A97")
      .describe(
        "Hex color for the tag dot, e.g. '#4DAB6F' for green, '#2383E2' for blue, '#E03E3E' for red, '#DFAB01' for yellow, '#9B59B6' for purple"
      ),
  },
  ({ table, column, value, color }) => {
    manager.addColumnOption(table, column, value, color);
    return {
      content: [
        {
          type: "text",
          text: `Added option "${value}" (${color}) to ${table}.${column}`,
        },
      ],
    };
  }
);

server.tool(
  "remove_column_option",
  "Remove a status/select option from a STATUS column",
  {
    table: z.string().describe("Table name"),
    column: z.string().describe("Column name"),
    value: z.string().describe("Option value to remove"),
  },
  ({ table, column, value }) => {
    manager.removeColumnOption(table, column, value);
    return {
      content: [
        {
          type: "text",
          text: `Removed option "${value}" from ${table}.${column}`,
        },
      ],
    };
  }
);

server.tool(
  "list_column_options",
  "List all status/select options for a column or all columns in the selected database",
  {
    table: z.string().optional().describe("Table name (omit to list all)"),
    column: z
      .string()
      .optional()
      .describe("Column name (omit to list all for the table)"),
  },
  ({ table, column }) => {
    if (table && column) {
      const options = manager.getColumnOptions(table, column);
      if (options.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No options defined for ${table}.${column}`,
            },
          ],
        };
      }
      const lines = options.map((o) => `  • ${o.value} (${o.color})`);
      return {
        content: [
          {
            type: "text",
            text: `Options for ${table}.${column}:\n${lines.join("\n")}`,
          },
        ],
      };
    }
    const all = manager.getAllColumnOptions();
    const keys = Object.keys(all);
    if (keys.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No column options defined in this database.",
          },
        ],
      };
    }
    const sections = keys.map((key) => {
      const lines = all[key].map((o) => `    • ${o.value} (${o.color})`);
      return `  ${key}:\n${lines.join("\n")}`;
    });
    return {
      content: [
        {
          type: "text",
          text: `Column options:\n${sections.join("\n")}`,
        },
      ],
    };
  }
);

// ── Column order ────────────────────────────────────────────────────────────

server.tool(
  "reorder_columns",
  "Set the display order of columns for a table. Provide the full list of column names in the desired order.",
  {
    table: z.string().describe("Table name"),
    columns: z
      .array(z.string())
      .min(1)
      .describe("Column names in desired display order"),
  },
  ({ table, columns }) => {
    manager.setColumnOrder(table, columns);
    return {
      content: [
        {
          type: "text",
          text: `Column order for "${table}" updated: ${columns.join(", ")}`,
        },
      ],
    };
  }
);

server.tool(
  "get_column_order",
  "Get the current display order of columns for a table. Returns empty if no custom order is set.",
  {
    table: z.string().describe("Table name"),
  },
  ({ table }) => {
    const order = manager.getColumnOrder(table);
    if (order.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No custom column order set for "${table}". Using default schema order.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Column order for "${table}": ${order.join(", ")}`,
        },
      ],
    };
  }
);

// ── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't pollute the MCP stdio channel
  process.stderr.write(`DataBook MCP server running. Data directory: ${DATA_DIR}\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});

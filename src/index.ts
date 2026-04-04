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

const FIELD_TYPES = [
  "text", "number", "select", "multi_select", "date", "checkbox", "url", "email",
  "phone", "status", "person", "file", "relation", "rollup",
  "created_time", "created_by", "last_edited_time", "last_edited_by", "unique_id",
] as const;

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
  fieldType: z.enum(FIELD_TYPES).optional().describe("DataBook field type controlling how the column renders in the UI: text, number, select, multi_select, date, checkbox, url, email"),
  fieldConfig: z.record(z.unknown()).optional().describe("Field type config. For select/multi_select: { options: [{ value, color }] }. For number: { format, decimals, prefix, suffix }."),
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
    fieldType: z.enum(FIELD_TYPES).optional().describe("DataBook field type for the new column"),
    fieldConfig: z.record(z.unknown()).optional().describe("Field type config"),
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

// ── Column Metadata (Field Types) ────────────────────────────────────────────

server.tool(
  "set_field_type",
  "Set the display field type for a column. This controls how the column renders in the DataBook UI (e.g. as a date picker, colored select dropdown, clickable URL, etc.). The underlying SQLite data type is unchanged.",
  {
    table: z.string().describe("Table name"),
    column: z.string().describe("Column name"),
    field_type: z
      .enum(FIELD_TYPES)
      .describe("Field type: text, number, select, multi_select, date, checkbox, url, email"),
    config: z
      .record(z.unknown())
      .optional()
      .describe(
        "Type-specific config. For select/multi_select: { options: [{ value: string, color: string }] }. For number: { format: 'plain'|'currency'|'percent', decimals: number, prefix: string, suffix: string }. For date: { includeTime: boolean }."
      ),
  },
  ({ table, column, field_type, config }) => {
    manager.setColumnMetadata(table, column, field_type, config ?? {});
    return {
      content: [
        {
          type: "text",
          text: `Set field type for "${table}"."${column}" to "${field_type}"${config ? ` with config: ${JSON.stringify(config)}` : ""}`,
        },
      ],
    };
  }
);

server.tool(
  "get_field_types",
  "List all column field type metadata for a table. Shows how each column is configured to render in the DataBook UI.",
  {
    table: z.string().describe("Table name"),
  },
  ({ table }) => {
    const metadata = manager.getAllColumnMetadata(table);
    const keys = Object.keys(metadata);
    if (keys.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No custom field types set for "${table}". All columns use default rendering based on SQLite type.`,
          },
        ],
      };
    }
    const lines = keys.map((col) => {
      const m = metadata[col];
      const configStr = Object.keys(m.config).length > 0 ? ` — ${JSON.stringify(m.config)}` : "";
      return `  • ${col}: ${m.field_type}${configStr}`;
    });
    return {
      content: [
        {
          type: "text",
          text: `Field types for "${table}":\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ── Row History ─────────────────────────────────────────────────────────────

server.tool(
  "get_table_history",
  "Show the change history for a table. Returns a list of row-level changes (insert, update, delete) in reverse chronological order, like `git log`.",
  {
    table: z.string().describe("Table name"),
    limit: z.number().optional().default(50).describe("Max entries to return (default 50)"),
    offset: z.number().optional().default(0).describe("Offset for pagination"),
  },
  ({ table, limit, offset }) => {
    const entries = manager.getTableHistory(table, limit, offset);
    if (entries.length === 0) {
      return { content: [{ type: "text", text: `No history for table "${table}".` }] };
    }
    const lines = entries.map((e) => {
      const data = e.action === "delete" ? JSON.stringify(e.old_data) : JSON.stringify(e.new_data);
      return `  #${e.id} [${e.action}] row ${e.row_pk ?? "?"} @ ${e.created_at}\n    ${data}`;
    });
    return { content: [{ type: "text", text: `History for "${table}" (${entries.length} entries):\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "get_row_history",
  "Show the full change history for a specific row, identified by its primary key value. Like `git log` for a single file.",
  {
    table: z.string().describe("Table name"),
    row_pk: z.string().describe("Primary key value of the row"),
  },
  ({ table, row_pk }) => {
    const entries = manager.getRowHistory(table, row_pk);
    if (entries.length === 0) {
      return { content: [{ type: "text", text: `No history for row "${row_pk}" in "${table}".` }] };
    }
    const lines = entries.map((e) => {
      const summary = e.action === "update"
        ? `old: ${JSON.stringify(e.old_data)}\n    new: ${JSON.stringify(e.new_data)}`
        : e.action === "delete"
        ? JSON.stringify(e.old_data)
        : JSON.stringify(e.new_data);
      return `  #${e.id} [${e.action}] @ ${e.created_at}\n    ${summary}`;
    });
    return { content: [{ type: "text", text: `History for row "${row_pk}" in "${table}" (${entries.length} entries):\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "revert_change",
  "Revert a specific change by its history ID, like `git revert`. Undoes the effect of that change: deletes an inserted row, restores an updated row to its previous state, or re-inserts a deleted row.",
  {
    history_id: z.number().describe("The history entry ID to revert (from get_table_history or get_row_history)"),
  },
  ({ history_id }) => {
    const result = manager.revertChange(history_id);
    return { content: [{ type: "text", text: result.detail }] };
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

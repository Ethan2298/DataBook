# DataBook

An AI-editable SQL database app powered by MCP. The MCP server *is* the app — its tool definitions encode the product decisions. The AI's capabilities become the feature set.

## What is DataBook?

DataBook is a Model Context Protocol (MCP) server that gives AI assistants full control over a collection of SQLite databases. Instead of building a traditional CRUD UI, DataBook exposes database operations as MCP tools — letting any MCP-capable AI client (Claude, Cursor, etc.) act as the interface.

## Tools

### Database Management
| Tool | Description |
|------|-------------|
| `list_databases` | List all available databases |
| `select_database` | Choose which database to work with |
| `create_database` | Create a new empty database |
| `delete_database` | Delete a database permanently |

### Schema Management
| Tool | Description |
|------|-------------|
| `list_tables` | List all tables in the selected database |
| `describe_table` | Show table schema and column definitions |
| `create_table` | Create a table with column definitions |
| `alter_table` | Add, rename, drop columns, or rename the table |
| `drop_table` | Delete a table and all its data |

### Data CRUD
| Tool | Description |
|------|-------------|
| `insert_rows` | Insert one or more rows |
| `update_rows` | Update rows matching a WHERE condition |
| `delete_rows` | Delete rows matching a WHERE condition |

### Query
| Tool | Description |
|------|-------------|
| `query` | Execute any SQL statement and return results |

### Query Pages (Views)
| Tool | Description |
|------|-------------|
| `create_query_page` | Save a named query with a view type (table, kanban, calendar, etc.) |
| `list_query_pages` | List all saved query pages for the current database |
| `update_query_page` | Rename, change query, or change view type |
| `delete_query_page` | Remove a saved query page |

## Storage

- Each **database** is a separate `.db` SQLite file stored in `~/.databook/` (configurable via `DATABOOK_DIR`)
- **Query pages** are stored in `~/.databook/.meta.db` — a metadata SQLite database

## Setup

### Install

```bash
npm install
npm run build
```

### Run

```bash
npm start
# or
node dist/index.js
```

### Configure data directory

```bash
DATABOOK_DIR=/path/to/data node dist/index.js
```

## Connecting to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "databook": {
      "command": "node",
      "args": ["/path/to/DataBook/dist/index.js"],
      "env": {
        "DATABOOK_DIR": "/path/to/your/data"
      }
    }
  }
}
```

Or using `npx` after publishing:

```json
{
  "mcpServers": {
    "databook": {
      "command": "npx",
      "args": ["databook"]
    }
  }
}
```

## Architecture

```
DataBook MCP Server (TypeScript)
  │
  ├── DatabaseManager          # Core logic layer
  │   ├── SQLite files         # One .db file per database (via better-sqlite3)
  │   └── .meta.db             # Query pages metadata
  │
  └── McpServer (stdio)        # MCP transport
      └── 17 tools             # The complete feature set
```

## Development

```bash
npm run dev    # Watch mode (recompiles on change)
npm run build  # Production build
```

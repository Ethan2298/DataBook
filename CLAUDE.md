# DataBook Development Guide

## Project Overview

DataBook is a hybrid AI-editable SQL database application with two modes of operation:

1. **MCP Server Mode**: Standalone Node.js server that exposes database operations as MCP tools. This is the core product — the MCP tool definitions ARE the feature set. Designed to work with Claude, Cursor, and other MCP-capable AI clients.

2. **Electron Desktop App**: A desktop UI wrapper built with React, Vite, and Electron. It shares the same `DatabaseManager` core logic but adds a graphical interface with filtering, sorting, and visualization features.

**Key Philosophy**: "The MCP server IS the app — its tool definitions encode the product decisions. The AI's capabilities become the feature set."

## Technology Stack

**Core Technologies:**
- **Runtime**: Node.js >= 18
- **Language**: TypeScript 5.8 (strict mode enabled)
- **Database**: SQLite via `better-sqlite3` (11.9.1)
- **CLI/MCP**: `@modelcontextprotocol/sdk` (1.10.2)
- **Validation**: Zod (3.24.2) for tool schema definitions
- **Build**: TypeScript compiler (`tsc`)

**Electron UI (Optional):**
- **Frontend**: React 19.2.4
- **Build Tool**: Vite 8.0.1
- **Styling**: CSS (no CSS framework)
- **IPC Bridge**: Electron IPC for backend communication
- **File Watching**: Chokidar 4.0.3 for external database changes

**Testing:**
- **Framework**: Vitest 4.1.2
- **Globals**: Enabled
- **Test Directory**: `tests/`

## Directory Structure

```
DataBook/
├── src/
│   ├── index.ts                    # MCP server entry point (#!/usr/bin/env node)
│   └── database-manager.ts         # Core DatabaseManager class (~1142 lines)
├── tests/
│   ├── helpers/
│   │   └── setup.ts                # Test utility (createTestManager)
│   └── database-manager/
│       ├── crud.test.ts            # Insert, update, delete tests
│       ├── schema.test.ts          # Table creation, alteration tests
│       ├── query.test.ts           # Raw SQL execution tests
│       ├── query-pages.test.ts     # Saved query page CRUD tests
│       ├── column-options.test.ts  # Status tag option tests
│       ├── column-order.test.ts    # Column ordering tests
│       ├── lifecycle.test.ts       # Database create/select/delete tests
│       └── row-history.test.ts     # Row history & revert tests
├── electron/
│   ├── main.cjs                    # Electron main process (CommonJS)
│   ├── preload.cjs                 # Electron IPC bridge to renderer
│   └── renderer/
│       ├── src/
│       │   ├── main.tsx            # React entry point
│       │   ├── App.tsx             # Root component (~800+ lines, complex)
│       │   ├── api.ts              # Typed IPC API wrapper
│       │   ├── data.ts             # Shared type definitions
│       │   ├── filter-sort.ts      # Filter & sort engine
│       │   ├── styles.css          # Global styles
│       │   └── components/         # React components (TableView, KanbanView, etc.)
│       ├── vite.config.ts          # Vite dev server (port 5173)
│       ├── tsconfig.json           # React-specific TS config
│       └── index.html              # HTML entry point
├── mcp-server/                     # Published MCP server package
├── package.json                    # Main workspace (type: "module")
├── tsconfig.json                   # Root TypeScript config
├── vitest.config.ts                # Vitest configuration
└── README.md                        # User documentation

```

## Environment & Configuration

**Environment Variables:**
- `DATABOOK_DIR`: Path where SQLite databases are stored. Defaults to `~/.databook/`
- `NODE_ENV`: Implicitly affects build output (dev vs. production)

**Data Storage:**
- User databases: `~/.databook/*.db` (one SQLite file per database)
- Metadata database: `~/.databook/.meta.db` (query pages, column metadata, row history)
- WAL mode enabled for concurrent read performance
- Foreign keys enabled

## Key Architectural Patterns

### 1. DatabaseManager Class

The core singleton that manages all database operations. Key characteristics:

**Database Selection Pattern:**
```typescript
manager.createDatabase("mydb");  // Creates ~/.databook/mydb.db
manager.selectDatabase("mydb");  // Sets currentDb for subsequent operations
// Now all schema/data operations apply to mydb
```

**Stateful Connection:**
- Maintains `currentDb` (current connection) and `currentDbName` (currently selected database name)
- Throws "No database selected" if operations attempted without `selectDatabase()`
- Metadata stored in separate `.meta.db` SQLite database

**Schema Management:**
- Tables created with quoted identifiers to handle special chars
- Column constraints via builder pattern (primaryKey, autoIncrement, notNull, unique, defaultValue)
- Metadata stored for UI rendering hints (fieldType, fieldConfig)

**Data Integrity:**
- Row history tracking on INSERT/UPDATE/DELETE via `recordHistory()`
- Transactional operations where appropriate
- SQL injection prevention via parameterized queries

**Field Types System:**
Notion-like field types (19 types) with metadata storage:
- Basic: `text`, `number`, `checkbox`, `date`
- Structured: `select`, `multi_select`, `status`
- Meta: `created_time`, `created_by`, `last_edited_time`, `last_edited_by`, `unique_id`
- Relations: `relation`, `rollup`
- Specialized: `url`, `email`, `phone`, `person`, `file`

### 2. MCP Tool Architecture

`src/index.ts` creates an MCP server with 17+ tools organized by domain:

**Tool Categories:**
1. **Database Management** (4 tools): list, select, create, delete databases
2. **Schema Management** (5 tools): list/describe/create/alter/drop tables
3. **Data CRUD** (3 tools): insert/update/delete rows
4. **Query** (1 tool): raw SQL execution
5. **Query Pages** (4 tools): save/list/update/delete named queries with view types
6. **Column Options** (2 tools): manage status tag values and colors
7. **Column Metadata** (4+ tools): set/get field types and configurations
8. **Row History** (3 tools): track changes, list history, revert edits

**Tool Definition Pattern:**
```typescript
server.tool("tool_name", "Description", 
  { param: z.string().describe("...") },  // Zod schema for validation
  ({ param }) => {                          // Handler function
    const result = manager.methodName(param);
    return {
      content: [{ type: "text", text: "Result message" }]
    };
  }
);
```

### 3. Electron IPC Bridge

**Main Process (`electron/main.cjs`):**
- Dynamically imports ESM `DatabaseManager` from compiled `dist/database-manager.js`
- Wraps each DatabaseManager method in `handle()` function
- Exposes 40+ IPC channels, one per database operation
- File watcher watches `DATABOOK_DIR` for external changes (e.g., MCP modifications)

**Preload Script (`electron/preload.cjs`):**
- Context bridge exposes safe API surface to renderer
- All database operations are async promises
- No direct file system access from renderer

**Renderer (`electron/renderer/src/api.ts`):**
- Typed wrapper around `window.databook` IPC bridge
- Mirrors DatabaseManager public API
- Returns promises from all operations

### 4. React Component State Management

**App.tsx** (Root Component):
- Database state: currentDb, databases, tables, queryPages
- View state: activeItem (current table/queryPage), rows, columns
- UI state: loading, error, modal visibility, toasts, dialogs
- Metadata state: columnOptions, columnMetadata, viewConfig (filters/sorts)
- Callback pattern for nested updates (no Redux/Zustand)

**Views:**
- TableView: Grid with column resize, reorder, sorting, filtering
- KanbanView: Grouped by select/status column with drag-and-drop
- CalendarView: Date-column grouped with event editing
- Multiple view types per query page (saved with query_pages metadata)

**Filter/Sort Engine (`filter-sort.ts`):**
- Notion-like filtering with text, number, boolean, date, status operators
- Multi-rule groups with AND/OR conjunction
- Persistent view configuration per table/queryPage

### 5. Testing Conventions

**Test Setup (`tests/helpers/setup.ts`):**
```typescript
const { manager, tmpDir, cleanup } = createTestManager();
// Creates isolated temp directory with fresh DatabaseManager instance
// cleanup() removes temp directory and closes connections
```

**Test Structure:**
```typescript
describe("Feature", () => {
  beforeEach(() => {
    ({ manager, cleanup } = createTestManager());
    manager.createDatabase("testdb");
    manager.selectDatabase("testdb");
  });
  
  afterEach(() => cleanup());
  
  it("test case", () => {
    // Arrange: Set up data
    manager.createTable("users", [...]);
    
    // Act: Perform operation
    const result = manager.insertRows("users", [...]);
    
    // Assert: Verify result
    expect(result).toBe(1);
  });
});
```

**Test Coverage Areas:**
- Schema: table creation, alteration (add/rename/drop columns), constraints
- CRUD: insert (single/batch), update (with WHERE), delete, transactions
- Query: SELECT, INSERT, UPDATE, DELETE execution, parameterized queries
- Query Pages: scoped to database, unique names, view types (table/kanban/calendar)
- Column Metadata: field types, field configs, migrations
- Row History: insert/update/delete tracking, revert functionality

## Building & Running

**Installation:**
```bash
npm install
```

**Development:**
```bash
npm run dev              # Watch mode for TypeScript + Electron + Vite renderer
npm run dev:ts          # TypeScript watch only
npm run dev:electron    # Electron process only (requires running dev:renderer)
npm run dev:renderer    # Vite dev server (React HMR on port 5173)
```

**Production Build:**
```bash
npm run build            # Compile TypeScript + copy to mcp-server/dist
npm run build:renderer   # Build React app with Vite
npm start                # Run compiled server: node dist/index.js
```

**Testing:**
```bash
npm test                 # Run all tests once
npm run test:watch      # Watch mode for tests
```

**Connecting to Claude Desktop:**
Add to `~/.config/Claude/claude_desktop_config.json`:
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

## Code Conventions

### TypeScript

- **Strict Mode**: Enabled in `tsconfig.json`
- **Module Format**: ESM (type: "module" in package.json)
- **Naming**: camelCase for functions/variables, PascalCase for classes/types
- **Exports**: Named exports for utility functions, default export for main class/component
- **Type Safety**: Explicit return types on public methods

### Database Manager

**Method Organization:**
1. Private constructor that initializes metadata database
2. Database management methods (public)
3. Schema management methods (public)
4. Row CRUD methods (public)
5. Query methods (public)
6. Query page methods (private/public)
7. Row history methods (private/public)
8. Column metadata methods (private/public)
9. Type definitions and helpers (bottom of file)

**SQL Injection Prevention:**
- Always use parameterized queries with `?` placeholders
- Quote identifiers: `` `"${table}"` ``
- Escape quotes in identifiers: `name.replace(/"/g, '""')`

**Error Handling:**
- Throw descriptive errors for invalid operations
- No silent failures
- Let database constraints bubble up for validation

### MCP Tools

**Schema Validation:**
- Use Zod schemas for all tool inputs
- Discriminated unions for complex inputs (e.g., AlterOperation)
- Descriptive error messages in response.content
- All responses return `{ content: [{ type: "text", text: "..." }] }`

### React Components

**Patterns:**
- Functional components with hooks
- useState for local state
- useCallback for stable function references
- useMemo for expensive computations
- Props drilling (no context, no Redux)
- ErrorBoundary for crash protection

**Styling:**
- Global `styles.css` with CSS variables
- Inline styles for conditional styling
- BEM-like class naming

## Common Tasks

### Adding a New Tool

1. Implement method in `DatabaseManager` class
2. Create MCP tool in `src/index.ts`:
   ```typescript
   server.tool("tool_name", "Description", { params }, ({ params }) => {
     const result = manager.method(params);
     return { content: [{ type: "text", text: "Success" }] };
   });
   ```
3. Add corresponding IPC handler in `electron/main.cjs`:
   ```typescript
   handle('db:methodName', (m, ...args) => m.method(...args));
   ```
4. Add to `api.ts` type definition:
   ```typescript
   methodName(...args): Promise<ReturnType>;
   ```
5. Add test coverage in `tests/database-manager/`

### Adding a New Field Type

1. Add to `FieldType` union in `src/database-manager.ts`
2. Add to `FIELD_TYPES` array in `src/index.ts`
3. Update column metadata migration if needed
4. Handle in `App.tsx` component rendering logic
5. Test with `column-metadata.test.ts` and `crud.test.ts`

### Modifying Schema

Migrations are handled automatically via `ALTER TABLE` if the column doesn't exist. The `initMeta()` method checks for missing columns and adds them as needed.

### Running Tests

- Add test file in `tests/database-manager/`
- Use `createTestManager()` from setup
- Run `npm test` or `npm run test:watch`

## Git Conventions

**Commit Messages:**
- Feature: `feat: add feature description`
- Fix: `fix: resolve issue description`
- Refactor: `refactor: improve code quality`
- Test: `test: add test coverage`
- Docs: `docs: update documentation`
- UI: `ui: redesign component`

**Branches:**
- Feature branches from `main`
- Code review before merging (when applicable)
- Tests must pass before merge

## Known Limitations & Edge Cases

1. **Composite Primary Keys**: Row history doesn't support tables with composite primary keys
2. **Column Constraints**: SQLite is more permissive than other databases (e.g., no true ENUM type)
3. **WAL Mode**: Write-ahead logging improves concurrency but adds .db-wal and .db-shm files
4. **AUTOINCREMENT**: Requires INTEGER PRIMARY KEY
5. **Unique IDs**: Generated using timestamp + random (not cryptographically secure)
6. **Metadata Migrations**: Column additions are safe but require graceful version checking

## Debugging Tips

**MCP Server Debugging:**
```bash
DATABOOK_DIR=/tmp/test npm start
# stdout/stderr will show MCP messages
```

**Electron Debugging:**
- DevTools: Press F12 in Electron window
- Main process logging: Check console output
- Renderer: Use Chrome DevTools

**Database Issues:**
```bash
# Inspect .meta.db directly
sqlite3 ~/.databook/.meta.db "SELECT * FROM query_pages;"

# Check WAL files (auto-cleanup)
ls -la ~/.databook/*.db*
```

**Test Debugging:**
```bash
npm run test:watch -- --reporter=verbose path/to/test.ts
```

## Performance Considerations

- **Transactions**: Wrap multiple operations in `db.transaction()` for atomic writes
- **Indexes**: Created on metadata lookups (query_pages, column_order, row_history)
- **WAL Mode**: Enabled for better concurrent reads
- **Query Complexity**: Row history can grow large; pagination implemented (limit/offset)
- **Filter/Sort**: Applied in JavaScript; no server-side filtering in MCP mode

## Security Notes

- **File Path Validation**: Database names sanitized to alphanumeric/dash/underscore/dot
- **SQL Injection**: Parameterized queries used throughout
- **Electron Sandbox**: Preload script uses contextBridge, no direct file access from renderer
- **IPC Validation**: Each handler accepts specific argument types
- **Environment**: `DATABOOK_DIR` is the only configurable security boundary

---

Last Updated: 2026-04-05

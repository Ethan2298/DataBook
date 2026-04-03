import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import TableView from "./components/TableView";
import KanbanView from "./components/KanbanView";
import CalendarView from "./components/CalendarView";
import EmptyState from "./components/EmptyState";
import ErrorBoundary from "./components/ErrorBoundary";
import ColumnPicker from "./components/ColumnPicker";
import api from "./api";
import type { QueryPage, Row, ViewType, ViewConfig, ActiveItem, ColumnInfo, ColumnOptionsMap } from "./data";

export default function App() {
  // Database state
  const [databases, setDatabases] = useState<string[]>([]);
  const [currentDb, setCurrentDb] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [queryPages, setQueryPages] = useState<QueryPage[]>([]);

  // Active view state
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [columnOptions, setColumnOptions] = useState<ColumnOptionsMap>({});
  const [viewConfig, setViewConfig] = useState<ViewConfig>({});

  // Ref to read latest activeItem inside effects without re-subscribing
  const activeItemRef = useRef(activeItem);
  useEffect(() => { activeItemRef.current = activeItem; }, [activeItem]);

  // Load databases on mount
  useEffect(() => {
    api.listDatabases().then(setDatabases).catch(console.error);
  }, []);

  // Auto-refresh when MCP or another process modifies the database files
  useEffect(() => {
    const cleanup = api.onExternalChange(async () => {
      // Refresh database list
      const dbs = await api.listDatabases().catch(() => [] as string[]);
      setDatabases(dbs);

      // If we have a selected database, refresh its contents
      if (currentDb) {
        try {
          // Re-select to ensure the connection is still valid
          await api.selectDatabase(currentDb);
          const [tbls, pages, colOpts] = await Promise.all([
            api.listTables(),
            api.listQueryPages(),
            api.getAllColumnOptions(),
          ]);
          setTables(tbls);
          setQueryPages(pages);
          setColumnOptions(colOpts);

          // Re-run the active view's query
          const current = activeItemRef.current;
          if (current) {
            const result = await api.query(current.sql);
            setRows(result);
            if (current.kind === "table") {
              const cols = await api.describeTable(current.name);
              setColumns(cols);
            } else if (result.length > 0) {
              setColumns(
                Object.keys(result[0]).map((key, i) => ({
                  cid: i,
                  name: key,
                  type: typeof result[0][key] === "number" ? "INTEGER" : "TEXT",
                  notnull: 0,
                  dflt_value: null,
                  pk: 0,
                }))
              );
            }
          }
        } catch {
          // Database may have been deleted externally
          if (!dbs.includes(currentDb)) {
            setCurrentDb(null);
            setTables([]);
            setQueryPages([]);
            setActiveItem(null);
            setRows([]);
            setColumns([]);
          }
        }
      }
    });

    return cleanup;
  }, [currentDb]);

  // Select a database — automatically shows an "all" view
  const selectDb = useCallback(async (name: string) => {
    try {
      await api.selectDatabase(name);
      setCurrentDb(name);
      setError(null);

      const [tbls, pages, colOpts] = await Promise.all([
        api.listTables(),
        api.listQueryPages(),
        api.getAllColumnOptions(),
      ]);
      setTables(tbls);
      setQueryPages(pages);
      setColumnOptions(colOpts);

      // Auto-select: first query page, or a SELECT * from first table
      if (pages.length > 0) {
        const first = pages[0];
        const item: ActiveItem = {
          kind: "query_page",
          name: first.name,
          viewType: (first.view_type as ViewType) || "table",
          sql: first.query,
        };
        setActiveItem(item);
        const result = await api.query(first.query);
        setRows(result);
        // Try to extract table name from simple SELECT queries to get real schema types
        const tableMatch = first.query.match(/FROM\s+["']?(\w+)["']?/i);
        if (tableMatch && tbls.includes(tableMatch[1])) {
          const cols = await api.describeTable(tableMatch[1]);
          setColumns(cols);
        } else if (result.length > 0) {
          setColumns(
            Object.keys(result[0]).map((key, i) => ({
              cid: i,
              name: key,
              type: typeof result[0][key] === "number" ? "INTEGER" : "TEXT",
              notnull: 0,
              dflt_value: null,
              pk: 0,
            }))
          );
        } else {
          setColumns([]);
        }
      } else if (tbls.length > 0) {
        // Fallback: show first table raw
        const tableName = tbls[0];
        const sql = `SELECT * FROM "${tableName}"`;
        const item: ActiveItem = { kind: "table", name: tableName, viewType: "table", sql };
        setActiveItem(item);
        const [cols, result] = await Promise.all([
          api.describeTable(tableName),
          api.query(sql),
        ]);
        setColumns(cols);
        setRows(result);
      } else {
        setActiveItem(null);
        setRows([]);
        setColumns([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Create a new database
  const createDb = useCallback(async (name: string) => {
    try {
      await api.createDatabase(name);
      setDatabases((prev) => [...prev, name].sort());
      await selectDb(name);
    } catch (err) {
      setError(String(err));
    }
  }, [selectDb]);

  // Delete a database
  const deleteDb = useCallback(async (name: string) => {
    try {
      await api.deleteDatabase(name);
      setDatabases((prev) => prev.filter((d) => d !== name));
      if (currentDb === name) {
        setCurrentDb(null);
        setTables([]);
        setQueryPages([]);
        setActiveItem(null);
        setRows([]);
        setColumns([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDb]);

  // Execute a query and display results
  const runQuery = useCallback(async (sql: string) => {
    try {
      setError(null);
      const result = await api.query(sql);
      setRows(result);
    } catch (err) {
      setError(String(err));
      setRows([]);
    }
  }, []);

  // Select a table to view
  const selectTable = useCallback(async (tableName: string) => {
    const item: ActiveItem = {
      kind: "table",
      name: tableName,
      viewType: "table",
      sql: `SELECT * FROM "${tableName}"`,
    };
    setActiveItem(item);

    try {
      const [cols, result, colOpts] = await Promise.all([
        api.describeTable(tableName),
        api.query(item.sql),
        api.getAllColumnOptions(),
      ]);
      setColumns(cols);
      setRows(result);
      setColumnOptions(colOpts);
      setError(null);
    } catch (err) {
      setError(String(err));
      setRows([]);
      setColumns([]);
    }
  }, []);

  // Select a query page to view
  const selectQueryPage = useCallback(async (page: QueryPage) => {
    const item: ActiveItem = {
      kind: "query_page",
      name: page.name,
      viewType: (page.view_type as ViewType) || "table",
      sql: page.query,
    };
    setActiveItem(item);

    // Restore saved view config if present
    if (page.view_config) {
      try {
        const saved = JSON.parse(page.view_config) as ViewConfig;
        setViewConfig(saved);
      } catch {
        // Ignore invalid JSON
      }
    }

    try {
      const result = await api.query(page.query);
      setRows(result);
      // Try to get real schema types from the table
      const tableMatch = page.query.match(/FROM\s+["']?(\w+)["']?/i);
      if (tableMatch) {
        try {
          const cols = await api.describeTable(tableMatch[1]);
          setColumns(cols);
        } catch {
          // Fallback: derive from result keys
          if (result.length > 0) {
            setColumns(Object.keys(result[0]).map((key, i) => ({
              cid: i, name: key,
              type: typeof result[0][key] === "number" ? "INTEGER" : "TEXT",
              notnull: 0, dflt_value: null, pk: 0,
            })));
          } else {
            setColumns([]);
          }
        }
      } else if (result.length > 0) {
        setColumns(Object.keys(result[0]).map((key, i) => ({
          cid: i, name: key,
          type: typeof result[0][key] === "number" ? "INTEGER" : "TEXT",
          notnull: 0, dflt_value: null, pk: 0,
        })));
      } else {
        setColumns([]);
      }
      // Fetch column options for status rendering
      const colOpts = await api.getAllColumnOptions();
      setColumnOptions(colOpts);
      setError(null);
    } catch (err) {
      setError(String(err));
      setRows([]);
      setColumns([]);
    }
  }, []);

  // Change view type for active item
  const changeView = useCallback((viewType: ViewType) => {
    if (activeItem) {
      setActiveItem({ ...activeItem, viewType });
    }
  }, [activeItem]);

  // Refresh current data
  const refresh = useCallback(async () => {
    if (!activeItem) return;
    if (activeItem.kind === "table") {
      await selectTable(activeItem.name);
    } else {
      await runQuery(activeItem.sql);
    }
    // Refresh sidebar + column options
    if (currentDb) {
      const [tbls, pages, colOpts] = await Promise.all([
        api.listTables(),
        api.listQueryPages(),
        api.getAllColumnOptions(),
      ]);
      setTables(tbls);
      setQueryPages(pages);
      setColumnOptions(colOpts);
    }
  }, [activeItem, currentDb, selectTable, runQuery]);

  // Create table
  const createTable = useCallback(async (tableName: string, columnDefs: { name: string; type: string }[]) => {
    try {
      await api.createTable(tableName, columnDefs.map(c => ({
        name: c.name,
        type: c.type,
        primaryKey: c.name === "id",
        autoIncrement: c.name === "id" && c.type === "INTEGER",
      })));
      setTables((prev) => [...prev, tableName].sort());
      await selectTable(tableName);
    } catch (err) {
      setError(String(err));
    }
  }, [selectTable]);

  // Insert a row
  const insertRow = useCallback(async (table: string, row: Row) => {
    try {
      await api.insertRows(table, [row]);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh]);

  // Update a row
  const updateRow = useCallback(async (table: string, pkCol: string, pkVal: unknown, updates: Row) => {
    try {
      if (!columns.some((c) => c.name === pkCol)) {
        throw new Error(`Unknown column: ${pkCol}`);
      }
      await api.updateRows(table, updates, `"${pkCol}" = ?`, [pkVal]);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh, columns]);

  // Delete a row
  const deleteRow = useCallback(async (table: string, pkCol: string, pkVal: unknown) => {
    try {
      if (!columns.some((c) => c.name === pkCol)) {
        throw new Error(`Unknown column: ${pkCol}`);
      }
      await api.deleteRows(table, `"${pkCol}" = ?`, [pkVal]);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh, columns]);

  // Create query page
  const createQueryPage = useCallback(async (name: string, sql: string, viewType: string) => {
    try {
      const configJson = JSON.stringify(viewConfig);
      const page = await api.createQueryPage(name, sql, viewType, configJson);
      setQueryPages((prev) => [...prev, page]);
    } catch (err) {
      setError(String(err));
    }
  }, [viewConfig]);

  // Delete query page
  const deleteQueryPage = useCallback(async (name: string) => {
    try {
      await api.deleteQueryPage(name);
      setQueryPages((prev) => prev.filter((p) => p.name !== name));
      if (activeItem?.kind === "query_page" && activeItem.name === name) {
        setActiveItem(null);
        setRows([]);
        setColumns([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [activeItem]);

  // Drop a table
  const dropTable = useCallback(async (tableName: string) => {
    try {
      await api.dropTable(tableName);
      setTables((prev) => prev.filter((t) => t !== tableName));
      if (activeItem?.kind === "table" && activeItem.name === tableName) {
        setActiveItem(null);
        setRows([]);
        setColumns([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [activeItem]);

  // Derive column names for kanban/calendar views
  const colNames = useMemo(() => {
    if (columns.length > 0) return columns.map((c) => c.name);
    if (rows.length > 0) return Object.keys(rows[0]);
    return [];
  }, [columns, rows]);

  // Compute smart defaults for view config
  const defaultViewConfig = useMemo((): ViewConfig => {
    const defaultCol = colNames[colNames.length > 1 ? 1 : 0] ?? "";
    const dateCol = colNames.find((c) => /date|time|created|updated/i.test(c)) ?? colNames[colNames.length - 1] ?? "";
    return {
      groupByCol: defaultCol,
      titleCol: defaultCol,
      dateCol,
    };
  }, [colNames]);

  // Reset viewConfig to defaults when columns change (new table selected)
  const prevColNamesRef = useRef<string[]>([]);
  useEffect(() => {
    const key = colNames.join(",");
    const prevKey = prevColNamesRef.current.join(",");
    if (key !== prevKey) {
      prevColNamesRef.current = colNames;
      setViewConfig((prev) => ({
        groupByCol: prev.groupByCol && colNames.includes(prev.groupByCol) ? prev.groupByCol : defaultViewConfig.groupByCol,
        titleCol: prev.titleCol && colNames.includes(prev.titleCol) ? prev.titleCol : defaultViewConfig.titleCol,
        dateCol: prev.dateCol && colNames.includes(prev.dateCol) ? prev.dateCol : defaultViewConfig.dateCol,
      }));
    }
  }, [colNames, defaultViewConfig]);

  // Auto-save viewConfig when it changes on a query page
  const viewConfigRef = useRef(viewConfig);
  useEffect(() => {
    viewConfigRef.current = viewConfig;
  }, [viewConfig]);

  const prevSavedConfigRef = useRef<string>("");
  useEffect(() => {
    if (!activeItem || activeItem.kind !== "query_page") return;
    const configJson = JSON.stringify(viewConfig);
    // Skip if nothing changed or it's the initial load
    if (configJson === prevSavedConfigRef.current) return;
    prevSavedConfigRef.current = configJson;
    // Debounce: save after a short delay
    const timer = setTimeout(() => {
      api.updateQueryPage(activeItem.name, { view_config: configJson }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [viewConfig, activeItem]);

  // Resolved config: merge user overrides with defaults
  const resolvedConfig = useMemo((): Required<ViewConfig> => ({
    groupByCol: viewConfig.groupByCol || defaultViewConfig.groupByCol || "",
    titleCol: viewConfig.titleCol || defaultViewConfig.titleCol || "",
    dateCol: viewConfig.dateCol || defaultViewConfig.dateCol || "",
  }), [viewConfig, defaultViewConfig]);

  return (
    <div className="app">
      <Sidebar
        databases={databases}
        currentDb={currentDb}
        tables={tables}
        queryPages={queryPages}
        activeItem={activeItem}
        onSelectDb={selectDb}
        onCreateDb={createDb}
        onDeleteDb={deleteDb}
        onSelectTable={selectTable}
        onDropTable={dropTable}
        onSelectQueryPage={selectQueryPage}
        onDeleteQueryPage={deleteQueryPage}
      />
      <main className="content">
        <ErrorBoundary>
        {currentDb && activeItem ? (
          <>
            <TopBar
              activeItem={activeItem}
              onViewChange={changeView}
              onCreateQueryPage={createQueryPage}
              onRefresh={refresh}
            />
            {error && <div className="error-bar">{error}</div>}
            {activeItem.viewType === "kanban" && colNames.length > 0 && (
              <div className="view-config-bar">
                <ColumnPicker
                  label="Group by"
                  value={resolvedConfig.groupByCol}
                  options={colNames}
                  onChange={(col) => setViewConfig((prev) => ({ ...prev, groupByCol: col }))}
                />
                <ColumnPicker
                  label="Card title"
                  value={resolvedConfig.titleCol}
                  options={colNames}
                  onChange={(col) => setViewConfig((prev) => ({ ...prev, titleCol: col }))}
                />
              </div>
            )}
            {activeItem.viewType === "calendar" && colNames.length > 0 && (
              <div className="view-config-bar">
                <ColumnPicker
                  label="Date field"
                  value={resolvedConfig.dateCol}
                  options={colNames}
                  onChange={(col) => setViewConfig((prev) => ({ ...prev, dateCol: col }))}
                />
                <ColumnPicker
                  label="Event title"
                  value={resolvedConfig.titleCol}
                  options={colNames}
                  onChange={(col) => setViewConfig((prev) => ({ ...prev, titleCol: col }))}
                />
              </div>
            )}
            {activeItem.viewType === "table" && (
              <TableView
                rows={rows}
                columns={columns}
                activeItem={activeItem}
                columnOptions={columnOptions}
                onInsertRow={activeItem.kind === "table" ? (row) => insertRow(activeItem.name, row) : undefined}
                onUpdateRow={activeItem.kind === "table" ? (pkCol, pkVal, updates) => updateRow(activeItem.name, pkCol, pkVal, updates) : undefined}
                onDeleteRow={activeItem.kind === "table" ? (pkCol, pkVal) => deleteRow(activeItem.name, pkCol, pkVal) : undefined}
              />
            )}
            {activeItem.viewType === "kanban" && (
              <KanbanView
                rows={rows}
                groupByCol={resolvedConfig.groupByCol}
                titleCol={resolvedConfig.titleCol}
                columns={colNames}
                pkCol={columns.find((c) => c.pk)?.name ?? "id"}
                tableName={activeItem.name}
                columnOptions={columnOptions}
                columnInfos={columns}
                onUpdateRow={activeItem.kind === "table" ? (pkCol, pkVal, updates) => updateRow(activeItem.name, pkCol, pkVal, updates) : undefined}
                onInsertRow={activeItem.kind === "table" ? (row) => insertRow(activeItem.name, row) : undefined}
              />
            )}
            {activeItem.viewType === "calendar" && (() => {
              const calTableName = activeItem.kind === "table" ? activeItem.name : undefined;
              const calStatusCol = calTableName
                ? colNames.find((c) => columnOptions[`${calTableName}.${c}`]?.length > 0) ?? null
                : null;
              return (
                <CalendarView
                  rows={rows}
                  dateCol={resolvedConfig.dateCol}
                  titleCol={resolvedConfig.titleCol}
                  columnOptions={columnOptions}
                  statusCol={calStatusCol}
                  tableName={calTableName}
                  columns={columns}
                  onInsertRow={activeItem.kind === "table" ? (row) => insertRow(activeItem.name, row) : undefined}
                  onUpdateRow={activeItem.kind === "table" ? (pkCol, pkVal, updates) => updateRow(activeItem.name, pkCol, pkVal, updates) : undefined}
                />
              );
            })()}
          </>
        ) : (
          <EmptyState
            hasDb={currentDb !== null}
            hasTables={tables.length > 0}
            onCreateDb={createDb}
            onCreateTable={createTable}
          />
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

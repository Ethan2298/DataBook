import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Row, ColumnInfo, ActiveItem, ColumnOptionsMap, ColumnMetadataMap, ColumnMetadata, FieldType } from "../data";
import DetailPanel from "./DetailPanel";
import api from "../api";
import CellRenderer from "./cells/CellRenderer";
import FieldTypePicker, { fieldTypeIcon } from "./FieldTypePicker";

const restrictToHorizontal: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});

const DEFAULT_COL_WIDTH = 180;

// ── Filter types ──────────────────────────────────────────────────────────

type FilterOperator = "equals" | "contains" | "not_equals" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

interface FilterDef {
  id: number;
  column: string;
  operator: FilterOperator;
  value: string;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "equals",
  contains: "contains",
  not_equals: "not equals",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const VALUELESS_OPERATORS: FilterOperator[] = ["is_empty", "is_not_empty"];

// ── Sort type ─────────────────────────────────────────────────────────────

interface SortState {
  col: string;
  dir: "asc" | "desc";
}

// ── Styles ────────────────────────────────────────────────────────────────

const toolbarStyles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    background: "#1a1a1a",
    borderBottom: "1px solid #2a2a2a",
    fontSize: 13,
  },
  filterBar: {
    padding: "6px 12px",
    background: "#1a1a1a",
    borderBottom: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  select: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#ebebeb",
    padding: "3px 6px",
    fontSize: 12,
    outline: "none",
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#ebebeb",
    padding: "3px 6px",
    fontSize: 12,
    outline: "none",
    width: 120,
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "#9B9A97",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  addBtn: {
    background: "none",
    border: "1px solid #333",
    color: "#9B9A97",
    cursor: "pointer",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#9B9A97",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: 14,
    lineHeight: 1,
  },
  popover: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 4,
    background: "#1f1f1f",
    border: "1px solid #333",
    borderRadius: 6,
    padding: 8,
    zIndex: 100,
    minWidth: 180,
    maxHeight: 300,
    overflowY: "auto",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 6px",
    cursor: "pointer",
    borderRadius: 4,
    fontSize: 13,
    color: "#ebebeb",
  },
};

interface TableViewProps {
  rows: Row[];
  columns: ColumnInfo[];
  activeItem: ActiveItem;
  columnOptions: ColumnOptionsMap;
  columnMetadata: ColumnMetadataMap;
  onInsertRow?: (row: Row) => void;
  onUpdateRow?: (pkCol: string, pkVal: unknown, updates: Row) => void;
  onDeleteRow?: (pkCol: string, pkVal: unknown) => void;
  onFieldTypeChange?: (column: string, fieldType: FieldType, config: Record<string, unknown>) => void;
}

export default function TableView({ rows, columns, activeItem, columnOptions, columnMetadata, onInsertRow, onUpdateRow, onDeleteRow, onFieldTypeChange }: TableViewProps) {
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Row>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [activeDragCol, setActiveDragCol] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [fieldTypePicker, setFieldTypePicker] = useState<string | null>(null);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

  // Feature 1: Sort state
  const [sortState, setSortState] = useState<SortState | null>(null);

  // Feature 2: Filter state
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const filterIdRef = useRef(0);

  // Feature 3: Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnVisibility, setShowColumnVisibility] = useState(false);
  const columnVisibilityRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidthsRef.current[col] ?? DEFAULT_COL_WIDTH;
    resizingRef.current = { col, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.col]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // Get the table name from the activeItem for column option lookups
  const tableName = useMemo(() => {
    if (activeItem.kind === "table") return activeItem.name;
    const m = activeItem.sql.match(/FROM\s+["']?(\w+)["']?/i);
    return m ? m[1] : "";
  }, [activeItem]);

  // Load persisted column order when table changes
  useEffect(() => {
    if (!tableName) return;
    api.getColumnOrder(tableName).then((order) => {
      setColumnOrder(order.length > 0 ? order : null);
    }).catch(() => {});
  }, [tableName]);

  // Reset sort, filters, hidden columns when active item changes
  useEffect(() => {
    setSortState(null);
    setFilters([]);
    setShowFilterBar(false);
    setHiddenColumns(new Set());
  }, [activeItem.name, activeItem.sql]);

  // Derive column names, hiding PK/id columns from display
  const pkCol = columns.find((c) => c.pk)?.name ?? "id";
  const allColNames = useMemo(() => columns.length > 0
    ? columns.map((c) => c.name)
    : rows.length > 0
      ? Object.keys(rows[0])
      : [], [columns, rows]);
  const baseColNames = useMemo(() => allColNames.filter((c) => {
    const colDef = columns.find((cd) => cd.name === c);
    if (colDef?.pk) return false;
    if (c.toLowerCase() === "id" || c.toLowerCase() === "rowid") return false;
    return true;
  }), [allColNames, columns]);

  // Apply custom column order if set, filtering out stale entries and appending new ones
  const orderedColNames = useMemo(() => {
    if (!columnOrder) return baseColNames;
    const ordered = columnOrder.filter((c) => baseColNames.includes(c));
    const remaining = baseColNames.filter((c) => !columnOrder.includes(c));
    return [...ordered, ...remaining];
  }, [columnOrder, baseColNames]);

  // Feature 3: Apply column visibility filter
  const colNames = useMemo(() => {
    if (hiddenColumns.size === 0) return orderedColNames;
    return orderedColNames.filter((c) => !hiddenColumns.has(c));
  }, [orderedColNames, hiddenColumns]);

  // Feature 2: Filter rows
  const filteredRows = useMemo(() => {
    if (filters.length === 0) return rows;
    return rows.filter((row) => {
      return filters.every((f) => {
        const val = row[f.column];
        const strVal = val == null ? "" : String(val);
        switch (f.operator) {
          case "equals":
            return strVal === f.value;
          case "contains":
            return strVal.toLowerCase().includes(f.value.toLowerCase());
          case "not_equals":
            return strVal !== f.value;
          case "greater_than":
            return Number(strVal) > Number(f.value);
          case "less_than":
            return Number(strVal) < Number(f.value);
          case "is_empty":
            return val == null || strVal === "";
          case "is_not_empty":
            return val != null && strVal !== "";
          default:
            return true;
        }
      });
    });
  }, [rows, filters]);

  // Feature 1: Sort rows
  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const { col, dir } = sortState;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return dir === "asc" ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortState]);

  // Sort click handler: none -> asc -> desc -> none
  const handleSortClick = useCallback((col: string) => {
    setSortState((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }, []);

  // Filter helpers
  const addFilter = useCallback(() => {
    const id = ++filterIdRef.current;
    setFilters((prev) => [...prev, { id, column: orderedColNames[0] ?? "", operator: "contains", value: "" }]);
    setShowFilterBar(true);
  }, [orderedColNames]);

  const updateFilter = useCallback((id: number, patch: Partial<FilterDef>) => {
    setFilters((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const removeFilter = useCallback((id: number) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) setShowFilterBar(false);
      return next;
    });
  }, []);

  // Column visibility toggle
  const toggleColumnVisibility = useCallback((col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        // Don't allow hiding all columns
        if (next.size >= orderedColNames.length - 1) return prev;
        next.add(col);
      }
      return next;
    });
  }, [orderedColNames]);

  // Close column visibility popover on outside click
  useEffect(() => {
    if (!showColumnVisibility) return;
    const handler = (e: MouseEvent) => {
      if (columnVisibilityRef.current && !columnVisibilityRef.current.contains(e.target as Node)) {
        setShowColumnVisibility(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnVisibility]);

  // Build effective metadata for each column: explicit metadata > auto-detect from SQLite type > default 'text'
  const getEffectiveMetadata = useCallback((col: string): ColumnMetadata => {
    // Check explicit metadata first
    if (columnMetadata[col]) return columnMetadata[col];

    // Auto-detect from SQLite column type
    const colDef = columns.find((c) => c.name === col);
    if (colDef) {
      const upper = colDef.type.toUpperCase();
      if (upper === "BOOLEAN") return { column: col, field_type: "checkbox", config: {} };
      if (upper === "STATUS") {
        const key = `${tableName}.${col}`;
        const opts = columnOptions[key] ?? [];
        return { column: col, field_type: "select", config: { options: opts.map((o) => ({ value: o.value, color: o.color })) } };
      }
    }

    return { column: col, field_type: "text", config: {} };
  }, [columnMetadata, columns, tableName, columnOptions]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragCol(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragCol(null);
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const order = prev ?? [...colNames];
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return order;
      const newOrder = arrayMove(order, oldIndex, newIndex);
      if (tableName) {
        const rollback = prev;
        api.setColumnOrder(tableName, newOrder).catch(() => {
          setColumnOrder(rollback);
        });
      }
      return newOrder;
    });
  }, [colNames, tableName]);

  const handleInsert = () => {
    if (!onInsertRow) return;
    const cleaned: Row = {};
    for (const [k, v] of Object.entries(newRowValues)) {
      if (v !== "" && v != null) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) {
      onInsertRow(cleaned);
      setNewRowValues({});
      setShowNewRow(false);
    }
  };

  // Compute a CSS grid-template-columns value so every row shares the same grid
  const gridTemplate = [
    ...(onDeleteRow ? ["32px"] : []),
    ...colNames.map((col) => `${columnWidths[col] ?? DEFAULT_COL_WIDTH}px`),
  ].join(" ");

  if (colNames.length === 0 && rows.length === 0) {
    return (
      <div className="view-table">
        <div className="table-empty">
          <span className="table-empty-text">No data to display</span>
        </div>
      </div>
    );
  }

  return (
    <div className="view-table">
      {/* ── Toolbar: Filter + Column visibility ── */}
      <div style={toolbarStyles.toolbar}>
        <button
          style={toolbarStyles.addBtn}
          onClick={addFilter}
          title="Add filter"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filter
        </button>
        <div style={{ position: "relative" }} ref={columnVisibilityRef}>
          <button
            style={toolbarStyles.iconBtn}
            onClick={() => setShowColumnVisibility((p) => !p)}
            title="Toggle column visibility"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Columns
          </button>
          {showColumnVisibility && (
            <div style={toolbarStyles.popover}>
              {orderedColNames.map((col) => (
                <label
                  key={col}
                  style={{
                    ...toolbarStyles.checkboxRow,
                    opacity: hiddenColumns.has(col) ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col)}
                    onChange={() => toggleColumnVisibility(col)}
                    style={{ accentColor: "#2383E2" }}
                  />
                  {col}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      {showFilterBar && filters.length > 0 && (
        <div style={toolbarStyles.filterBar}>
          {filters.map((f) => (
            <div key={f.id} style={toolbarStyles.filterRow}>
              <select
                style={toolbarStyles.select}
                value={f.column}
                onChange={(e) => updateFilter(f.id, { column: e.target.value })}
              >
                {orderedColNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                style={toolbarStyles.select}
                value={f.operator}
                onChange={(e) => updateFilter(f.id, { operator: e.target.value as FilterOperator })}
              >
                {(Object.keys(OPERATOR_LABELS) as FilterOperator[]).map((op) => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>
              {!VALUELESS_OPERATORS.includes(f.operator) && (
                <input
                  style={toolbarStyles.input}
                  placeholder="value"
                  value={f.value}
                  onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                />
              )}
              <button
                style={toolbarStyles.removeBtn}
                onClick={() => removeFilter(f.id)}
                title="Remove filter"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="table-scroll">
        {/* ── Header with dnd-kit reorder ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontal]}>
          <div className="table-header-row" style={{ gridTemplateColumns: gridTemplate }}>
            {onDeleteRow && <div className="th th-actions" />}
            <SortableContext items={colNames} strategy={horizontalListSortingStrategy}>
              {colNames.map((col) => (
                <SortableHeaderCell
                  key={col}
                  col={col}
                  isActive={activeDragCol === col}
                  onResizeStart={handleResizeStart}
                  sortDir={sortState?.col === col ? sortState.dir : null}
                  onSortClick={handleSortClick}
                  fieldType={getEffectiveMetadata(col).field_type}
                  showPicker={fieldTypePicker === col}
                  onTogglePicker={() => setFieldTypePicker(fieldTypePicker === col ? null : col)}
                  onFieldTypeChange={onFieldTypeChange ? (ft) => {
                    onFieldTypeChange(col, ft, ft === getEffectiveMetadata(col).field_type ? getEffectiveMetadata(col).config : {});
                    setFieldTypePicker(null);
                  } : undefined}
                  onClosePicker={() => setFieldTypePicker(null)}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className="table-grid" style={{ gridTemplateColumns: gridTemplate }}>
          {/* ── Data rows ── */}
          {sortedRows.map((row, rowIdx) => (
            <div
              key={String(row[pkCol] ?? rowIdx)}
              className="table-row"
              style={{ display: "contents" }}
              onMouseEnter={() => setHoveredRow(rowIdx)}
              onMouseLeave={() => setHoveredRow((prev) => prev === rowIdx ? null : prev)}
            >
              {onDeleteRow && (
                <div className="td td-actions">
                  <button
                    className={`row-expand-btn${hoveredRow === rowIdx ? " row-expand-visible" : ""}`}
                    onClick={() => setDetailRow(row)}
                    title="View details"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                  <button
                    className={`row-delete-btn${hoveredRow === rowIdx ? " row-delete-visible" : ""}`}
                    onClick={() => onDeleteRow(pkCol, row[pkCol])}
                    title="Delete row"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              {colNames.map((col) => {
                const meta = getEffectiveMetadata(col);
                return (
                  <div key={col} className={`td${meta.field_type === "checkbox" ? " td-checkbox" : ""}`}>
                    <CellRenderer
                      value={row[col]}
                      metadata={meta}
                      onCommitEdit={(val) => {
                        if (!onUpdateRow) return;
                        onUpdateRow(pkCol, row[pkCol], { [col]: val });
                      }}
                      disabled={!onUpdateRow}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* ── New row input ── */}
          {onInsertRow && showNewRow && (
            <div className="table-row new-row-input" style={{ display: "contents" }}>
              {onDeleteRow && <div className="td td-actions" />}
              {colNames.map((col) => {
                const colDef = columns.find((c) => c.name === col);
                if (colDef?.pk && colDef.type === "INTEGER") return (
                  <div key={col} className="td">
                    <span className="cell-text auto-text">auto</span>
                  </div>
                );
                const meta = getEffectiveMetadata(col);
                if (meta.field_type === "checkbox") return (
                  <div key={col} className="td td-checkbox">
                    <label className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={!!newRowValues[col]}
                        onChange={() => setNewRowValues((prev) => ({ ...prev, [col]: prev[col] ? 0 : 1 }))}
                      />
                      <span className="checkbox-mark" />
                    </label>
                  </div>
                );
                if (meta.field_type === "select" || meta.field_type === "multi_select") {
                  const options = (meta.config.options as { value: string }[]) ?? [];
                  if (meta.field_type === "multi_select") {
                    const selected: string[] = (() => {
                      const v = newRowValues[col];
                      if (!v) return [];
                      try { const p = JSON.parse(String(v)); if (Array.isArray(p)) return p; } catch {}
                      return [];
                    })();
                    return (
                      <div key={col} className="td">
                        <div className="multi-select-new-row">
                          {options.map((opt) => (
                            <label key={opt.value} className="multi-select-new-row-item">
                              <input
                                type="checkbox"
                                checked={selected.includes(opt.value)}
                                onChange={() => {
                                  const next = selected.includes(opt.value)
                                    ? selected.filter((s) => s !== opt.value)
                                    : [...selected, opt.value];
                                  setNewRowValues((prev) => ({ ...prev, [col]: JSON.stringify(next) }));
                                }}
                              />
                              <span>{opt.value}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={col} className="td">
                      <select
                        className="status-select"
                        value={String(newRowValues[col] ?? "")}
                        onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                      >
                        <option value="">---</option>
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (meta.field_type === "date") {
                  const includeTime = (meta.config as { includeTime?: boolean }).includeTime;
                  return (
                    <div key={col} className="td">
                      <input
                        className="cell-edit-input cell-date"
                        type={includeTime ? "datetime-local" : "date"}
                        value={String(newRowValues[col] ?? "")}
                        onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInsert();
                          if (e.key === "Escape") setShowNewRow(false);
                        }}
                      />
                    </div>
                  );
                }
                // Status: grouped select
                if (meta.field_type === "status") {
                  const groups = (meta.config.groups as { name: string; options: string[] }[]) ?? [];
                  const allOptions = groups.flatMap((g) => g.options);
                  return (
                    <div key={col} className="td">
                      <select
                        className="status-select"
                        value={String(newRowValues[col] ?? "")}
                        onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {groups.map((g) => (
                          <optgroup key={g.name} label={g.name}>
                            {g.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </optgroup>
                        ))}
                        {allOptions.length === 0 && <option disabled>No options configured</option>}
                      </select>
                    </div>
                  );
                }
                // Person: dropdown of configured names
                if (meta.field_type === "person") {
                  const people = (meta.config.people as { name: string }[]) ?? [];
                  return (
                    <div key={col} className="td">
                      <select
                        className="status-select"
                        value={String(newRowValues[col] ?? "")}
                        onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {people.map((p) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                // Read-only auto types: show "auto" label
                if (["created_time", "created_by", "last_edited_time", "last_edited_by", "unique_id", "rollup"].includes(meta.field_type)) {
                  return (
                    <div key={col} className="td">
                      <span className="cell-text auto-text">auto</span>
                    </div>
                  );
                }
                // Determine input type for remaining editable types
                const inputType = (() => {
                  switch (meta.field_type) {
                    case "number": return "number";
                    case "email": return "email";
                    case "url": return "url";
                    case "phone": return "tel";
                    default: return "text";
                  }
                })();
                return (
                  <div key={col} className="td">
                    <input
                      className="cell-edit-input"
                      type={inputType}
                      placeholder={col}
                      value={String(newRowValues[col] ?? "")}
                      onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInsert();
                        if (e.key === "Escape") setShowNewRow(false);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {onInsertRow && (
          <div className="new-row" onClick={() => setShowNewRow(!showNewRow)}>
            <div className="new-row-inner">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
              New
            </div>
          </div>
        )}
      </div>

      <div className="footer">
        <span className="footer-label">COUNT</span>
        <span className="footer-value">{sortedRows.length}</span>
      </div>

      <DetailPanel
        row={detailRow}
        columns={columns}
        columnOptions={columnOptions}
        tableName={tableName}
        onClose={() => setDetailRow(null)}
        onUpdateRow={onUpdateRow}
      />
    </div>
  );
}

// ── Sortable Header Cell ──────────────────────────────────────────────────

function SortableHeaderCell({ col, isActive, onResizeStart, sortDir, onSortClick, fieldType, showPicker, onTogglePicker, onFieldTypeChange, onClosePicker }: {
  col: string;
  isActive: boolean;
  onResizeStart: (col: string, e: React.MouseEvent) => void;
  sortDir: "asc" | "desc" | null;
  onSortClick: (col: string) => void;
  fieldType: FieldType;
  showPicker: boolean;
  onTogglePicker: () => void;
  onFieldTypeChange?: (fieldType: FieldType) => void;
  onClosePicker: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isActive ? 'rgba(31, 31, 31, 0.7)' : undefined,
    zIndex: isActive ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} className="th" style={style} {...attributes} {...listeners}>
      {onFieldTypeChange && (
        <button
          className="field-type-btn"
          onClick={(e) => { e.stopPropagation(); onTogglePicker(); }}
          onPointerDown={(e) => e.stopPropagation()}
          title={`Field type: ${fieldType}`}
        >
          {fieldTypeIcon(fieldType)}
        </button>
      )}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onSortClick(col);
        }}
        style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
      >
        {col}
        {sortDir === "asc" && <span style={{ fontSize: 10, color: "#2383E2" }}>&#9650;</span>}
        {sortDir === "desc" && <span style={{ fontSize: 10, color: "#2383E2" }}>&#9660;</span>}
      </span>
      <div
        className="col-resize-handle"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col, e); }}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {showPicker && onFieldTypeChange && (
        <FieldTypePicker
          currentType={fieldType}
          onSelect={onFieldTypeChange}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}

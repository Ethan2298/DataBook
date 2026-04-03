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
import type { Row, ColumnInfo, ActiveItem, ColumnOptionsMap } from "../data";
import DetailPanel from "./DetailPanel";
import api from "../api";

const restrictToHorizontal: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});

const DEFAULT_COL_WIDTH = 180;

interface TableViewProps {
  rows: Row[];
  columns: ColumnInfo[];
  activeItem: ActiveItem;
  columnOptions: ColumnOptionsMap;
  onInsertRow?: (row: Row) => void;
  onUpdateRow?: (pkCol: string, pkVal: unknown, updates: Row) => void;
  onDeleteRow?: (pkCol: string, pkVal: unknown) => void;
}

export default function TableView({ rows, columns, activeItem, columnOptions, onInsertRow, onUpdateRow, onDeleteRow }: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Row>({});
  const [statusDropdown, setStatusDropdown] = useState<{ rowIdx: number; col: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [activeDragCol, setActiveDragCol] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

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
  const colNames = useMemo(() => {
    if (!columnOrder) return baseColNames;
    const ordered = columnOrder.filter((c) => baseColNames.includes(c));
    const remaining = baseColNames.filter((c) => !columnOrder.includes(c));
    return [...ordered, ...remaining];
  }, [columnOrder, baseColNames]);

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

  const startEdit = (rowIdx: number, col: string, value: unknown) => {
    setEditingCell({ rowIdx, col });
    setEditValue(value == null ? "" : String(value));
  };

  const commitEdit = () => {
    if (!editingCell || !onUpdateRow) return;
    const row = rows[editingCell.rowIdx];
    if (row && String(row[editingCell.col]) !== editValue) {
      onUpdateRow(pkCol, row[pkCol], { [editingCell.col]: editValue });
    }
    setEditingCell(null);
  };

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

  const isCheckboxCol = (col: string): boolean => {
    const colDef = columns.find((c) => c.name === col);
    if (!colDef) return false;
    return colDef.type.toUpperCase() === "BOOLEAN";
  };

  const toggleCheckbox = (rowIdx: number, col: string) => {
    if (!onUpdateRow) return;
    const row = rows[rowIdx];
    const current = row[col];
    const newVal = current ? 0 : 1;
    onUpdateRow(pkCol, row[pkCol], { [col]: newVal });
  };

  // Check if a column has STATUS options defined
  const getStatusOptions = (col: string) => {
    // Check column type first
    const colDef = columns.find((c) => c.name === col);
    if (colDef && colDef.type.toUpperCase() === "STATUS") {
      const key = `${tableName}.${col}`;
      return columnOptions[key] ?? [];
    }
    return [];
  };

  const isStatusCol = (col: string): boolean => {
    return getStatusOptions(col).length > 0;
  };

  // Get color for a status value from options
  const getStatusColor = (col: string, val: unknown): string => {
    if (val == null) return "#9B9A97";
    const options = getStatusOptions(col);
    const opt = options.find((o) => o.value === String(val));
    return opt?.color ?? "#9B9A97";
  };

  const selectStatus = (rowIdx: number, col: string, value: string) => {
    if (!onUpdateRow) return;
    const row = rows[rowIdx];
    onUpdateRow(pkCol, row[pkCol], { [col]: value });
    setStatusDropdown(null);
  };

  const formatValue = (val: unknown): string => {
    if (val == null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
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
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className="table-grid" style={{ gridTemplateColumns: gridTemplate }}>
          {/* ── Data rows ── */}
          {rows.map((row, rowIdx) => (
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
              {colNames.map((col) => (
                <div
                  key={col}
                  className={`td${isCheckboxCol(col) ? " td-checkbox" : ""}`}
                  onDoubleClick={() => !isCheckboxCol(col) && !isStatusCol(col) && onUpdateRow && startEdit(rowIdx, col, row[col])}
                >
                  {isCheckboxCol(col) ? (
                    <label className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!row[col]}
                        onChange={() => toggleCheckbox(rowIdx, col)}
                        disabled={!onUpdateRow}
                      />
                      <span className="checkbox-mark" />
                    </label>
                  ) : isStatusCol(col) ? (
                    <div className="status-cell" onClick={(e) => {
                      e.stopPropagation();
                      if (!onUpdateRow) return;
                      setStatusDropdown(
                        statusDropdown?.rowIdx === rowIdx && statusDropdown?.col === col
                          ? null
                          : { rowIdx, col }
                      );
                    }}>
                      {row[col] != null ? (
                        <span className="badge">
                          <span className="badge-dot" style={{ backgroundColor: getStatusColor(col, row[col]) }} />
                          {formatValue(row[col])}
                        </span>
                      ) : (
                        <span className="cell-text status-empty">—</span>
                      )}
                      {statusDropdown?.rowIdx === rowIdx && statusDropdown?.col === col && (
                        <StatusDropdown
                          options={getStatusOptions(col)}
                          currentValue={row[col] == null ? "" : String(row[col])}
                          onSelect={(val) => selectStatus(rowIdx, col, val)}
                          onClose={() => setStatusDropdown(null)}
                        />
                      )}
                    </div>
                  ) : editingCell?.rowIdx === rowIdx && editingCell.col === col ? (
                    <input
                      className="cell-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="cell-text">{formatValue(row[col])}</span>
                  )}
                </div>
              ))}
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
                if (isCheckboxCol(col)) return (
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
                if (isStatusCol(col)) {
                  const options = getStatusOptions(col);
                  return (
                    <div key={col} className="td">
                      <select
                        className="status-select"
                        value={String(newRowValues[col] ?? "")}
                        onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={col} className="td">
                    <input
                      className="cell-edit-input"
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
        <span className="footer-value">{rows.length}</span>
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

function SortableHeaderCell({ col, isActive, onResizeStart }: {
  col: string;
  isActive: boolean;
  onResizeStart: (col: string, e: React.MouseEvent) => void;
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
      <span>{col}</span>
      <div
        className="col-resize-handle"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col, e); }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Status Dropdown Component ──────────────────────────────────────────────

interface StatusDropdownProps {
  options: { value: string; color: string }[];
  currentValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function StatusDropdown({ options, currentValue, onSelect, onClose }: StatusDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="status-dropdown" ref={ref} onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`status-dropdown-item ${opt.value === currentValue ? "active" : ""}`}
          onClick={() => onSelect(opt.value)}
        >
          <span className="badge-dot" style={{ backgroundColor: opt.color }} />
          <span>{opt.value}</span>
        </div>
      ))}
    </div>
  );
}

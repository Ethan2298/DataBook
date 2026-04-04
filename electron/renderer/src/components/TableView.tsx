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
import api from "../api";
import CellRenderer from "./cells/CellRenderer";
import FieldTypePicker, { fieldTypeIcon } from "./FieldTypePicker";

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
  const [fieldTypePicker, setFieldTypePicker] = useState<string | null>(null);
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
                        <option value="">—</option>
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
        <span className="footer-value">{rows.length}</span>
      </div>
    </div>
  );
}

// ── Sortable Header Cell ──────────────────────────────────────────────────

function SortableHeaderCell({ col, isActive, onResizeStart, fieldType, showPicker, onTogglePicker, onFieldTypeChange, onClosePicker }: {
  col: string;
  isActive: boolean;
  onResizeStart: (col: string, e: React.MouseEvent) => void;
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
      <span>{col}</span>
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

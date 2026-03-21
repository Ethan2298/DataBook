import { useState, useRef, useEffect, useMemo } from "react";
import type { Row, ColumnInfo, ActiveItem, ColumnOptionsMap } from "../data";

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

  // Derive column names, hiding PK/id columns from display
  const pkCol = columns.find((c) => c.pk)?.name ?? "id";
  const allColNames = columns.length > 0
    ? columns.map((c) => c.name)
    : rows.length > 0
      ? Object.keys(rows[0])
      : [];
  const colNames = allColNames.filter((c) => {
    const colDef = columns.find((cd) => cd.name === c);
    if (colDef?.pk) return false;
    if (c.toLowerCase() === "id" || c.toLowerCase() === "rowid") return false;
    return true;
  });

  // Get the table name from the activeItem for column option lookups
  const tableName = useMemo(() => {
    if (activeItem.kind === "table") return activeItem.name;
    const m = activeItem.sql.match(/FROM\s+["']?(\w+)["']?/i);
    return m ? m[1] : "";
  }, [activeItem]);

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
      <div className="table-header">
        {onDeleteRow && <div className="col col-actions" />}
        {colNames.map((col) => (
          <div key={col} className="col col-dynamic">
            <span>{col}</span>
          </div>
        ))}
      </div>

      <div className="table-body">
        {rows.map((row, rowIdx) => (
          <div key={String(row[pkCol] ?? rowIdx)} className="table-row">
            {onDeleteRow && (
              <div className="col col-actions">
                <button
                  className="row-delete-btn"
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
                className={`col col-dynamic${isCheckboxCol(col) ? " col-checkbox" : ""}`}
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

        {/* New row input */}
        {onInsertRow && showNewRow && (
          <div className="table-row new-row-input">
            <div className="col col-actions" />
            {colNames.map((col) => {
              const colDef = columns.find((c) => c.name === col);
              // Skip auto-increment PK columns
              if (colDef?.pk && colDef.type === "INTEGER") return (
                <div key={col} className="col col-dynamic">
                  <span className="cell-text auto-text">auto</span>
                </div>
              );
              if (isCheckboxCol(col)) return (
                <div key={col} className="col col-dynamic col-checkbox">
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
                  <div key={col} className="col col-dynamic">
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
                <div key={col} className="col col-dynamic">
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

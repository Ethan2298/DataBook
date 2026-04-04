import { useState, useRef, useEffect, useCallback } from "react";
import type { Row, ColumnInfo, ColumnOptionsMap } from "../data";
import { getPkColumn, isPkColumn } from "./columnUtils";

interface DetailPanelProps {
  row: Row | null;
  columns: ColumnInfo[];
  columnOptions: ColumnOptionsMap;
  tableName: string;
  onClose: () => void;
  onUpdateRow?: (pkCol: string, pkVal: unknown, updates: Row) => void;
}

export default function DetailPanel({ row, columns, columnOptions, tableName, onClose, onUpdateRow }: DetailPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [statusDropdownField, setStatusDropdownField] = useState<string | null>(null);
  const [localRow, setLocalRow] = useState<Row | null>(row);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync localRow when the prop changes (e.g. different row selected)
  useEffect(() => { setLocalRow(row); }, [row]);

  // Reset editing state when row changes
  useEffect(() => {
    setEditingField(null);
    setStatusDropdownField(null);
  }, [row]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const pkCol = getPkColumn(columns) ?? "id";

  const getStatusOptions = useCallback((col: string) => {
    const colDef = columns.find((c) => c.name === col);
    if (colDef && colDef.type.toUpperCase() === "STATUS") {
      const key = `${tableName}.${col}`;
      return columnOptions[key] ?? [];
    }
    return [];
  }, [columns, tableName, columnOptions]);

  const isStatusCol = (col: string) => getStatusOptions(col).length > 0;

  const isCheckboxCol = (col: string) => {
    const colDef = columns.find((c) => c.name === col);
    return colDef?.type.toUpperCase() === "BOOLEAN";
  };

  const isPkCol = (col: string) => isPkColumn(columns, col);

  const getStatusColor = (col: string, val: unknown): string => {
    if (val == null) return "#9B9A97";
    const options = getStatusOptions(col);
    const opt = options.find((o) => o.value === String(val));
    return opt?.color ?? "#9B9A97";
  };

  const formatValue = (val: unknown): string => {
    if (val == null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const startEdit = (col: string, value: unknown) => {
    if (!onUpdateRow || isPkCol(col)) return;
    setEditingField(col);
    setEditValue(value == null ? "" : String(value));
  };

  const commitEdit = () => {
    if (!editingField || !onUpdateRow || !localRow) return;
    if (String(localRow[editingField]) !== editValue) {
      onUpdateRow(pkCol, localRow[pkCol], { [editingField]: editValue });
      setLocalRow((prev) => prev ? { ...prev, [editingField]: editValue } : prev);
    }
    setEditingField(null);
  };

  const toggleCheckbox = (col: string) => {
    if (!onUpdateRow || !localRow) return;
    const newVal = localRow[col] ? 0 : 1;
    onUpdateRow(pkCol, localRow[pkCol], { [col]: newVal });
    setLocalRow((prev) => prev ? { ...prev, [col]: newVal } : prev);
  };

  const selectStatus = (col: string, value: string) => {
    if (!onUpdateRow || !localRow) return;
    onUpdateRow(pkCol, localRow[pkCol], { [col]: value });
    setLocalRow((prev) => prev ? { ...prev, [col]: value } : prev);
    setStatusDropdownField(null);
  };

  // Get display columns (all column names from the row)
  const displayCols = columns.length > 0
    ? columns.map((c) => c.name)
    : localRow ? Object.keys(localRow) : [];

  if (!localRow) return null;

  return (
    <>
      <div className="detail-panel-backdrop" onClick={onClose} />
      <div className="detail-panel" ref={panelRef}>
        <div className="detail-panel-header">
          <span className="detail-panel-title">Row Details</span>
          <button className="detail-panel-close" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="detail-panel-body">
          {displayCols.map((col) => (
            <div key={col} className="detail-panel-field">
              <div className="detail-panel-label">{col}</div>
              <div className="detail-panel-value">
                {isCheckboxCol(col) ? (
                  <label className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!localRow[col]}
                      onChange={() => toggleCheckbox(col)}
                      disabled={!onUpdateRow}
                    />
                    <span className="checkbox-mark" />
                  </label>
                ) : isStatusCol(col) ? (
                  <div
                    className="detail-panel-status"
                    onClick={() => {
                      if (!onUpdateRow) return;
                      setStatusDropdownField(statusDropdownField === col ? null : col);
                    }}
                    style={{ cursor: onUpdateRow ? "pointer" : "default" }}
                  >
                    {localRow[col] != null ? (
                      <span className="badge">
                        <span className="badge-dot" style={{ backgroundColor: getStatusColor(col, localRow[col]) }} />
                        {formatValue(localRow[col])}
                      </span>
                    ) : (
                      <span className="detail-panel-empty">--</span>
                    )}
                    {statusDropdownField === col && (
                      <DetailStatusDropdown
                        options={getStatusOptions(col)}
                        currentValue={localRow[col] == null ? "" : String(localRow[col])}
                        onSelect={(val) => selectStatus(col, val)}
                        onClose={() => setStatusDropdownField(null)}
                      />
                    )}
                  </div>
                ) : editingField === col ? (
                  <input
                    ref={inputRef}
                    className="detail-panel-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingField(null);
                    }}
                  />
                ) : (
                  <div
                    className={`detail-panel-text${onUpdateRow && !isPkCol(col) ? " editable" : ""}`}
                    onClick={() => !isStatusCol(col) && !isCheckboxCol(col) && startEdit(col, localRow[col])}
                  >
                    {formatValue(localRow[col]) || <span className="detail-panel-empty">--</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DetailStatusDropdown({ options, currentValue, onSelect, onClose }: {
  options: { value: string; color: string }[];
  currentValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
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

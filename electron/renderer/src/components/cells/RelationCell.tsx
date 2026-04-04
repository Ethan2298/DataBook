import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";
import api from "../../api";

function parseIds(value: unknown): string[] {
  if (value == null) return [];
  const str = String(value);
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function RelationCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const [displayMap, setDisplayMap] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<{ id: string; display: string }[]>([]);
  const [searchText, setSearchText] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetTable = (metadata.config.targetTable as string) ?? "";
  const displayColumn = (metadata.config.displayColumn as string) ?? "name";
  const ids = parseIds(value);

  // Resolve display names for current IDs
  useEffect(() => {
    if (ids.length === 0 || !targetTable) return;
    api.resolveRelation(targetTable, ids, displayColumn)
      .then(setDisplayMap)
      .catch(() => {});
  }, [value, targetTable, displayColumn]);

  // Search target table when typing
  useEffect(() => {
    if (!open || !targetTable || !searchText) {
      setSearchResults([]);
      return;
    }
    const safeDisplay = displayColumn.replace(/"/g, '""');
    const safeTable = targetTable.replace(/"/g, '""');
    api.query(`SELECT rowid, "${safeDisplay}" as display FROM "${safeTable}" WHERE "${safeDisplay}" LIKE ? LIMIT 20`, [`%${searchText}%`])
      .then((rows) => {
        setSearchResults(rows.map((r) => ({ id: String(r.rowid), display: String(r.display ?? r.rowid) })));
      })
      .catch(() => setSearchResults([]));
  }, [searchText, open, targetTable, displayColumn]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggleId = (id: string) => {
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    onCommitEdit(next.length > 0 ? JSON.stringify(next) : null);
  };

  return (
    <div className="status-cell cell-relation" ref={ref} onClick={(e) => {
      e.stopPropagation();
      if (!disabled) { setOpen(!open); setSearchText(""); }
    }}>
      <div className="relation-chips">
        {ids.length === 0 ? (
          <span className="cell-text status-empty">—</span>
        ) : (
          ids.map((id) => (
            <span key={id} className="relation-chip">
              {displayMap[id] || `#${id}`}
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="status-dropdown relation-dropdown" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            className="relation-search"
            type="text"
            placeholder={`Search ${targetTable}...`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {searchResults.map((r) => (
            <div
              key={r.id}
              className={`status-dropdown-item ${ids.includes(r.id) ? "active" : ""}`}
              onClick={() => toggleId(r.id)}
            >
              <span className="multi-select-check">{ids.includes(r.id) ? "✓" : ""}</span>
              <span>{r.display}</span>
            </div>
          ))}
          {searchText && searchResults.length === 0 && (
            <div className="status-dropdown-item" style={{ opacity: 0.5 }}>No results</div>
          )}
        </div>
      )}
    </div>
  );
}

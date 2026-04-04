import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";
import { getInitialColor } from "./colors";

interface PersonOption {
  name: string;
  email?: string;
}

export default function PersonCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const people: PersonOption[] = (metadata.config.people as PersonOption[]) ?? [];
  const strVal = value == null ? "" : String(value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initial = strVal ? strVal.charAt(0).toUpperCase() : "";
  const color = strVal ? getInitialColor(strVal) : "#9B9A97";

  return (
    <div className="status-cell" ref={ref} onClick={(e) => {
      e.stopPropagation();
      if (!disabled) setOpen(!open);
    }}>
      {strVal ? (
        <span className="person-cell">
          <span className="person-initial" style={{ backgroundColor: color }}>{initial}</span>
          <span className="person-name">{strVal}</span>
        </span>
      ) : (
        <span className="cell-text status-empty">—</span>
      )}
      {open && (
        <div className="status-dropdown" onClick={(e) => e.stopPropagation()}>
          {strVal && (
            <div
              className="status-dropdown-item status-dropdown-clear"
              onClick={() => { onCommitEdit(null); setOpen(false); }}
            >
              <span className="cell-text status-empty">Clear</span>
            </div>
          )}
          {people.map((p) => (
            <div
              key={p.name}
              className={`status-dropdown-item ${p.name === strVal ? "active" : ""}`}
              onClick={() => { onCommitEdit(p.name); setOpen(false); }}
            >
              <span className="person-initial person-initial-sm" style={{ backgroundColor: getInitialColor(p.name) }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

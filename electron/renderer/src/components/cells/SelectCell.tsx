import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

interface SelectOption {
  value: string;
  color: string;
}

export default function SelectCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options: SelectOption[] = (metadata.config.options as SelectOption[]) ?? [];
  const strVal = value == null ? "" : String(value);
  const currentOpt = options.find((o) => o.value === strVal);
  const color = currentOpt?.color ?? "#9B9A97";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="status-cell" ref={ref} onClick={(e) => {
      e.stopPropagation();
      if (!disabled) setOpen(!open);
    }}>
      {strVal ? (
        <span className="badge">
          <span className="badge-dot" style={{ backgroundColor: color }} />
          {strVal}
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
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`status-dropdown-item ${opt.value === strVal ? "active" : ""}`}
              onClick={() => { onCommitEdit(opt.value); setOpen(false); }}
            >
              <span className="badge-dot" style={{ backgroundColor: opt.color }} />
              <span>{opt.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

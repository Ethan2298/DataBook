import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

interface StatusGroup {
  name: string;
  color: string;
  options: string[];
}

export default function StatusCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const groups: StatusGroup[] = (metadata.config.groups as StatusGroup[]) ?? [];
  const strVal = value == null ? "" : String(value);

  // Find which group this value belongs to
  const findGroup = (val: string): StatusGroup | undefined => {
    return groups.find((g) => g.options.includes(val));
  };
  const currentGroup = strVal ? findGroup(strVal) : undefined;
  const color = currentGroup?.color ?? "#9B9A97";

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
        <div className="status-dropdown status-grouped-dropdown" onClick={(e) => e.stopPropagation()}>
          {strVal && (
            <div
              className="status-dropdown-item status-dropdown-clear"
              onClick={() => { onCommitEdit(null); setOpen(false); }}
            >
              <span className="cell-text status-empty">Clear</span>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.name}>
              <div className="status-group-header">
                <span className="badge-dot" style={{ backgroundColor: group.color }} />
                <span>{group.name}</span>
              </div>
              {group.options.map((opt) => (
                <div
                  key={opt}
                  className={`status-dropdown-item ${opt === strVal ? "active" : ""}`}
                  onClick={() => { onCommitEdit(opt); setOpen(false); }}
                >
                  <span className="badge-dot" style={{ backgroundColor: group.color }} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

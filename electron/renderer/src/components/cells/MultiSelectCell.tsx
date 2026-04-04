import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

interface SelectOption {
  value: string;
  color: string;
}

function parseMultiValue(value: unknown): string[] {
  if (value == null) return [];
  const str = String(value);
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  // Fallback: comma-separated
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function MultiSelectCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options: SelectOption[] = (metadata.config.options as SelectOption[]) ?? [];
  const selected = parseMultiValue(value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
    onCommitEdit(JSON.stringify(next));
  };

  return (
    <div className="status-cell cell-multi-select" ref={ref} onClick={(e) => {
      e.stopPropagation();
      if (!disabled) setOpen(!open);
    }}>
      <div className="multi-select-badges">
        {selected.length === 0 ? (
          <span className="cell-text status-empty">—</span>
        ) : (
          selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span key={val} className="badge badge-sm">
                <span className="badge-dot" style={{ backgroundColor: opt?.color ?? "#9B9A97" }} />
                {val}
              </span>
            );
          })
        )}
      </div>
      {open && (
        <div className="status-dropdown multi-select-dropdown" onClick={(e) => e.stopPropagation()}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`status-dropdown-item ${selected.includes(opt.value) ? "active" : ""}`}
              onClick={() => toggle(opt.value)}
            >
              <span className="multi-select-check">{selected.includes(opt.value) ? "✓" : ""}</span>
              <span className="badge-dot" style={{ backgroundColor: opt.color }} />
              <span>{opt.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

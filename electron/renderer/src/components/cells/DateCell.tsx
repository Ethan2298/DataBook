import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

export default function DateCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const config = metadata.config as { includeTime?: boolean };
  const inputType = config.includeTime ? "datetime-local" : "date";

  const formatted = value == null ? "" : String(value);
  // Try to extract just the date portion for display
  const displayVal = formatted ? formatted.slice(0, config.includeTime ? 16 : 10) : "";

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className="cell-edit-input cell-date"
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (editValue !== displayVal) onCommitEdit(editValue || null);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (editValue !== displayVal) onCommitEdit(editValue || null);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cell-text cell-date"
      onDoubleClick={() => {
        if (disabled) return;
        setEditValue(displayVal);
        setEditing(true);
      }}
    >
      {displayVal}
    </span>
  );
}

import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

export default function TextCell({ value, onCommitEdit, disabled }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const formatted = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className="cell-edit-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (editValue !== formatted) onCommitEdit(editValue);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (editValue !== formatted) onCommitEdit(editValue);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cell-text"
      onDoubleClick={() => {
        if (disabled) return;
        setEditValue(formatted);
        setEditing(true);
      }}
    >
      {formatted}
    </span>
  );
}

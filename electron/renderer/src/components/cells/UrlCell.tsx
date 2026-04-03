import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

export default function UrlCell({ value, onCommitEdit, disabled }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const strVal = value == null ? "" : String(value);

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className="cell-edit-input"
        type="url"
        placeholder="https://..."
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (editValue !== strVal) onCommitEdit(editValue || null);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (editValue !== strVal) onCommitEdit(editValue || null);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  if (!strVal) {
    return <span className="cell-text" onDoubleClick={() => { if (!disabled) { setEditValue(""); setEditing(true); } }} />;
  }

  const isSafeUrl = /^https?:\/\//i.test(strVal);

  return (
    <span className="cell-url" onDoubleClick={() => {
      if (disabled) return;
      setEditValue(strVal);
      setEditing(true);
    }}>
      {isSafeUrl ? (
        <a href={strVal} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {strVal.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      ) : (
        <span className="cell-text">{strVal}</span>
      )}
    </span>
  );
}

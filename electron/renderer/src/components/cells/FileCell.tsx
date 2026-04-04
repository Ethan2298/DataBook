import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i;

function getFileName(val: string): string {
  try {
    const url = new URL(val);
    const segments = url.pathname.split("/");
    return segments[segments.length - 1] || val;
  } catch {
    // Not a URL — treat as file path
    const segments = val.replace(/\\/g, "/").split("/");
    return segments[segments.length - 1] || val;
  }
}

export default function FileCell({ value, onCommitEdit, disabled }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const strVal = value == null ? "" : String(value);
  const isImage = IMAGE_EXTS.test(strVal);
  const isUrl = /^https?:\/\//i.test(strVal);

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className="cell-edit-input"
        type="text"
        placeholder="File path or URL"
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

  return (
    <span className="cell-file" onDoubleClick={() => {
      if (disabled) return;
      setEditValue(strVal);
      setEditing(true);
    }}>
      {isImage && isUrl && (
        <img className="file-thumbnail" src={strVal} alt="" />
      )}
      <span className="file-name">
        {isUrl ? (
          <a href={strVal} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {getFileName(strVal)}
          </a>
        ) : (
          getFileName(strVal)
        )}
      </span>
    </span>
  );
}

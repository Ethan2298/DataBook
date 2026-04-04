import { useState, useRef, useEffect } from "react";
import type { CellProps } from "./types";

export default function NumberCell({ value, metadata, onCommitEdit, disabled }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const config = metadata.config as {
    format?: "plain" | "currency" | "percent";
    decimals?: number;
    prefix?: string;
    suffix?: string;
  };

  const numVal = value == null ? null : Number(value);

  const formatNumber = (n: number | null): string => {
    if (n == null) return "";
    const decimals = config.decimals ?? (config.format === "currency" ? 2 : undefined);
    let str = decimals != null ? n.toFixed(decimals) : String(n);
    // Add thousand separators for large numbers
    if (Math.abs(n) >= 1000) {
      const parts = str.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      str = parts.join(".");
    }
    if (config.format === "percent") return `${str}%`;
    const prefix = config.prefix ?? (config.format === "currency" ? "$" : "");
    const suffix = config.suffix ?? "";
    return `${prefix}${str}${suffix}`;
  };

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        className="cell-edit-input cell-number"
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          const parsed = Number(editValue);
          if (editValue !== String(numVal ?? "")) onCommitEdit(editValue === "" ? null : isNaN(parsed) ? null : parsed);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const parsed = Number(editValue);
            if (editValue !== String(numVal ?? "")) onCommitEdit(editValue === "" ? null : isNaN(parsed) ? null : parsed);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cell-text cell-number"
      onDoubleClick={() => {
        if (disabled) return;
        setEditValue(numVal == null ? "" : String(numVal));
        setEditing(true);
      }}
    >
      {formatNumber(numVal)}
    </span>
  );
}

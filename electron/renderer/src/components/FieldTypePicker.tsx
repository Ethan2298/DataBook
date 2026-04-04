import { useState, useRef, useEffect } from "react";
import type { FieldType } from "../data";

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Text", icon: "Aa" },
  { value: "number", label: "Number", icon: "#" },
  { value: "select", label: "Select", icon: "▾" },
  { value: "multi_select", label: "Multi Select", icon: "☰" },
  { value: "status", label: "Status", icon: "◉" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "checkbox", label: "Checkbox", icon: "☑" },
  { value: "url", label: "URL", icon: "🔗" },
  { value: "email", label: "Email", icon: "@" },
  { value: "phone", label: "Phone", icon: "📞" },
  { value: "person", label: "Person", icon: "👤" },
  { value: "file", label: "Files & Media", icon: "📎" },
  { value: "relation", label: "Relation", icon: "↗" },
  { value: "rollup", label: "Rollup", icon: "Σ" },
  { value: "created_time", label: "Created Time", icon: "⏱" },
  { value: "created_by", label: "Created By", icon: "✎" },
  { value: "last_edited_time", label: "Edited Time", icon: "⏱" },
  { value: "last_edited_by", label: "Edited By", icon: "✎" },
  { value: "unique_id", label: "ID", icon: "⌗" },
];

interface FieldTypePickerProps {
  currentType: FieldType;
  onSelect: (fieldType: FieldType) => void;
  onClose: () => void;
}

export default function FieldTypePicker({ currentType, onSelect, onClose }: FieldTypePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="field-type-picker" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="field-type-picker-title">Field Type</div>
      {FIELD_TYPE_OPTIONS.map((opt) => (
        <div
          key={opt.value}
          className={`field-type-picker-item${opt.value === currentType ? " active" : ""}`}
          onClick={() => onSelect(opt.value)}
        >
          <span className="field-type-icon">{opt.icon}</span>
          <span>{opt.label}</span>
        </div>
      ))}
    </div>
  );
}

export function fieldTypeIcon(type: FieldType): string {
  return FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.icon ?? "Aa";
}

import type { CellProps } from "./types";

export default function CheckboxCell({ value, onCommitEdit, disabled }: CellProps) {
  return (
    <label className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={() => onCommitEdit(value ? 0 : 1)}
        disabled={disabled}
      />
      <span className="checkbox-mark" />
    </label>
  );
}

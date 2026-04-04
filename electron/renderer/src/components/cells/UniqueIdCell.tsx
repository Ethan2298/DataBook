import type { CellProps } from "./types";

export default function UniqueIdCell({ value, metadata }: CellProps) {
  const strVal = value == null ? "" : String(value);
  const prefix = (metadata.config.prefix as string) ?? "";

  return (
    <span className="cell-text cell-readonly unique-id-cell">
      {strVal || (prefix ? `${prefix}...` : "—")}
    </span>
  );
}

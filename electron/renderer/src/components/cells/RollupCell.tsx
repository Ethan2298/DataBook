import type { CellProps } from "./types";

export default function RollupCell({ value, metadata }: CellProps) {
  const config = metadata.config as { aggregation?: string };
  const aggregation = config.aggregation ?? "count";
  const display = value == null ? "—" : String(value);
  const label = aggregation === "count" ? "count" : aggregation === "show_all" ? "" : aggregation;

  return (
    <span className="cell-text cell-readonly cell-rollup" title={`${label}: ${display}`}>
      {display}
    </span>
  );
}

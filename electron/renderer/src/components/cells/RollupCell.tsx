import { useState, useEffect } from "react";
import type { CellProps } from "./types";
import api from "../../api";

export default function RollupCell({ value, metadata }: CellProps) {
  const [computed, setComputed] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const config = metadata.config as {
    relationColumn?: string;
    targetColumn?: string;
    aggregation?: string;
  };
  const aggregation = config.aggregation ?? "count";

  // If value is already provided (pre-computed), use it
  // Otherwise, this is a display-only cell that shows what's stored
  useEffect(() => {
    if (value != null) {
      setComputed(value);
      return;
    }
    // No pre-computed value available
    setComputed(null);
  }, [value]);

  const display = computed == null ? "—" : String(computed);
  const label = aggregation === "count" ? "count" : aggregation === "show_all" ? "" : aggregation;

  return (
    <span className="cell-text cell-readonly cell-rollup" title={`${label}: ${display}`}>
      {display}
    </span>
  );
}

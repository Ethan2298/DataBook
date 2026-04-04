import type { CellProps } from "./types";
import { getInitialColor } from "./colors";

export default function ReadOnlyPersonCell({ value }: CellProps) {
  const strVal = value == null ? "" : String(value);
  if (!strVal) return <span className="cell-text cell-readonly">—</span>;

  const initial = strVal.charAt(0).toUpperCase();
  const color = getInitialColor(strVal);

  return (
    <span className="person-cell cell-readonly">
      <span className="person-initial" style={{ backgroundColor: color }}>{initial}</span>
      <span className="person-name">{strVal}</span>
    </span>
  );
}

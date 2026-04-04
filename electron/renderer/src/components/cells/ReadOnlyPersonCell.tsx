import type { CellProps } from "./types";

const COLORS = ["#2383E2", "#4DAB6F", "#D9730D", "#9B59B6", "#E03E3E", "#DFAB01"];

function getInitialColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

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

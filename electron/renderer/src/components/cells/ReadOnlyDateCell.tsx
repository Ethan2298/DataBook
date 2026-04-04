import type { CellProps } from "./types";

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatAbsolute(dateStr: string, includeTime: boolean): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  if (includeTime) {
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function ReadOnlyDateCell({ value, metadata }: CellProps) {
  const strVal = value == null ? "" : String(value);
  if (!strVal) return <span className="cell-text cell-readonly">—</span>;

  const config = metadata.config as { includeTime?: boolean; format?: "relative" | "absolute" };
  const includeTime = config.includeTime ?? true;
  const format = config.format ?? "relative";

  const display = format === "relative" ? formatRelative(strVal) : formatAbsolute(strVal, includeTime);

  return (
    <span className="cell-text cell-readonly" title={strVal}>
      {display}
    </span>
  );
}

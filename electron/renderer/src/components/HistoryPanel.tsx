import { useState, useEffect, useCallback, useMemo } from "react";
import type { RowHistoryEntry } from "../data";
import api from "../api";

interface HistoryPanelProps {
  tableName: string;
  onClose: () => void;
  onRevert: () => void;
}

// VS Code-style action icons & colors
const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  insert: { icon: "M", label: "Added row", color: "#73c991" },
  update: { icon: "M", label: "Modified row", color: "#e2c08d" },
  delete: { icon: "D", label: "Deleted row", color: "#c74e39" },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  }
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - entryDate.getTime();
  if (diff === 0) return "Today";
  if (diff <= 86_400_000) return "Yesterday";
  if (diff <= 604_800_000) return "This Week";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shortId(id: number): string {
  return String(id).padStart(7, "0");
}

function DiffBlock({ entry, expanded }: { entry: RowHistoryEntry; expanded: boolean }) {
  if (!expanded) return null;

  if (entry.action === "insert" && entry.new_data) {
    return (
      <div className="ht-diff">
        {Object.entries(entry.new_data).map(([k, v]) => (
          <div key={k} className="ht-diff-line ht-diff-add">
            <span className="ht-diff-sign">+</span>
            <span className="ht-diff-key">{k}</span>
            <span className="ht-diff-sep">: </span>
            <span className="ht-diff-val">{formatVal(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (entry.action === "delete" && entry.old_data) {
    return (
      <div className="ht-diff">
        {Object.entries(entry.old_data).map(([k, v]) => (
          <div key={k} className="ht-diff-line ht-diff-del">
            <span className="ht-diff-sign">-</span>
            <span className="ht-diff-key">{k}</span>
            <span className="ht-diff-sep">: </span>
            <span className="ht-diff-val">{formatVal(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (entry.action === "update" && entry.old_data && entry.new_data) {
    // Show fields in natural column order, changes inline
    const allKeys = Object.keys(entry.new_data);
    return (
      <div className="ht-diff">
        {allKeys.map((k) => {
          const oldVal = entry.old_data![k];
          const newVal = entry.new_data![k];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          if (!changed) {
            return (
              <div key={k} className="ht-diff-line ht-diff-ctx">
                <span className="ht-diff-sign"> </span>
                <span className="ht-diff-key">{k}</span>
                <span className="ht-diff-sep">: </span>
                <span className="ht-diff-val">{formatVal(oldVal)}</span>
              </div>
            );
          }
          return (
            <div key={k} className="ht-diff-change">
              <div className="ht-diff-line ht-diff-del">
                <span className="ht-diff-sign">-</span>
                <span className="ht-diff-key">{k}</span>
                <span className="ht-diff-sep">: </span>
                <span className="ht-diff-val">{formatVal(oldVal)}</span>
              </div>
              <div className="ht-diff-line ht-diff-add">
                <span className="ht-diff-sign">+</span>
                <span className="ht-diff-key">{k}</span>
                <span className="ht-diff-sep">: </span>
                <span className="ht-diff-val">{formatVal(newVal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

export default function HistoryPanel({ tableName, onClose, onRevert }: HistoryPanelProps) {
  const [entries, setEntries] = useState<RowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTableHistory(tableName, 200, 0);
      setEntries(result);
    } catch (err) {
      setEntries([]);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  // Reset expanded state and reload when table changes
  useEffect(() => {
    setExpandedIds(new Set());
    loadHistory();
  }, [loadHistory]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRevert = async (id: number) => {
    if (reverting !== null) return; // Block concurrent reverts
    setReverting(id);
    try {
      const result = await api.revertChange(id);
      onRevert();
      await loadHistory();
    } catch (err) {
      setError(`Revert failed: ${err}`);
    } finally {
      setReverting(null);
    }
  };

  // Group entries by date
  const grouped = useMemo(() => {
    const groups: { label: string; entries: RowHistoryEntry[] }[] = [];
    let currentLabel = "";
    for (const entry of entries) {
      const label = getDateGroup(entry.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, entries: [entry] });
      } else {
        groups[groups.length - 1].entries.push(entry);
      }
    }
    return groups;
  }, [entries]);

  return (
    <div className="ht-panel">
      {/* Header */}
      <div className="ht-header">
        <div className="ht-header-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32zM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
          </svg>
          <span>TIMELINE</span>
          <span className="ht-header-count">{entries.length}</span>
        </div>
        <div className="ht-header-actions">
          <button className="ht-icon-btn" onClick={loadHistory} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M4.681 3A5.5 5.5 0 0 1 8 2a5.5 5.5 0 0 1 5.5 5.5 .75.75 0 0 0 1.5 0A7 7 0 0 0 4.393 1.607L3.5.714V3h1.181zM11.32 13A5.5 5.5 0 0 1 8 14a5.5 5.5 0 0 1-5.5-5.5.75.75 0 0 0-1.5 0A7 7 0 0 0 11.607 14.393l.893.893V13h-1.18z"/>
            </svg>
          </button>
          <button className="ht-icon-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ht-body">
        {loading && <div className="ht-empty">Loading history...</div>}
        {!loading && error && (
          <div className="ht-error">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="ht-empty">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="#555" style={{ marginBottom: 8 }}>
              <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32zM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
            </svg>
            No changes recorded yet
          </div>
        )}
        {!loading && !error && grouped.map((group) => (
          <div key={group.label} className="ht-group">
            <div className="ht-group-label">{group.label}</div>
            <div className="ht-timeline">
              {group.entries.map((entry, idx) => {
                const meta = ACTION_META[entry.action] ?? { icon: "?", label: entry.action, color: "#888" };
                const isExpanded = expandedIds.has(entry.id);
                const isLast = idx === group.entries.length - 1;
                return (
                  <div key={entry.id} className="ht-entry">
                    {/* Timeline gutter */}
                    <div className="ht-gutter">
                      <div className="ht-dot" style={{ borderColor: meta.color }} />
                      {!isLast && <div className="ht-line" />}
                    </div>

                    {/* Content */}
                    <div className="ht-content">
                      <div className="ht-row" onClick={() => toggleExpand(entry.id)}>
                        <span className="ht-expand-icon">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                        <span className="ht-label" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="ht-pk">#{entry.row_pk ?? "?"}</span>
                        <span className="ht-time">{formatTimestamp(entry.created_at)}</span>
                        {/* Revert action */}
                        <button
                          className="ht-revert-icon"
                          onClick={(e) => { e.stopPropagation(); handleRevert(entry.id); }}
                          disabled={reverting !== null}
                          title="Revert this change"
                        >
                          {reverting === entry.id ? (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="ht-spin">
                              <path d="M4.681 3A5.5 5.5 0 0 1 8 2a5.5 5.5 0 0 1 5.5 5.5.75.75 0 0 0 1.5 0A7 7 0 0 0 4.393 1.607L3.5.714V3h1.181z"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="evenodd" d="M3.5 2v3.5L6 3H4.393A7 7 0 0 1 15 7.5a.75.75 0 0 1-1.5 0A5.5 5.5 0 0 0 4.681 3H3.5zm9 10.5V9L10 12.5h1.607A7 7 0 0 1 1 8.5a.75.75 0 0 1 1.5 0 5.5 5.5 0 0 0 8.82 4.5H12.5z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="ht-commit-id">{shortId(entry.id)}</div>
                      <DiffBlock entry={entry} expanded={isExpanded} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import type { RowHistoryEntry } from "../data";
import api from "../api";

interface HistoryPanelProps {
  tableName: string;
  onClose: () => void;
  onRevert: () => void;  // called after a successful revert to refresh data
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  insert: { label: "INSERT", color: "#4DAB6F" },
  update: { label: "UPDATE", color: "#2383E2" },
  delete: { label: "DELETE", color: "#E03E3E" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

function ChangeSummary({ entry }: { entry: RowHistoryEntry }) {
  if (entry.action === "insert" && entry.new_data) {
    const keys = Object.keys(entry.new_data).slice(0, 3);
    return (
      <div className="history-summary">
        {keys.map((k) => (
          <span key={k} className="history-field">
            <span className="history-field-name">{k}:</span>{" "}
            <span className="history-field-value">{String(entry.new_data![k] ?? "")}</span>
          </span>
        ))}
        {Object.keys(entry.new_data).length > 3 && (
          <span className="history-field-more">+{Object.keys(entry.new_data).length - 3} more</span>
        )}
      </div>
    );
  }

  if (entry.action === "update" && entry.old_data && entry.new_data) {
    const changed: string[] = [];
    for (const k of Object.keys(entry.new_data)) {
      if (JSON.stringify(entry.old_data[k]) !== JSON.stringify(entry.new_data[k])) {
        changed.push(k);
      }
    }
    return (
      <div className="history-summary">
        {changed.slice(0, 3).map((k) => (
          <span key={k} className="history-field">
            <span className="history-field-name">{k}:</span>{" "}
            <span className="history-field-old">{String(entry.old_data![k] ?? "")}</span>
            <span className="history-arrow">{"\u2192"}</span>
            <span className="history-field-value">{String(entry.new_data![k] ?? "")}</span>
          </span>
        ))}
        {changed.length > 3 && (
          <span className="history-field-more">+{changed.length - 3} more fields</span>
        )}
      </div>
    );
  }

  if (entry.action === "delete" && entry.old_data) {
    const keys = Object.keys(entry.old_data).slice(0, 3);
    return (
      <div className="history-summary">
        {keys.map((k) => (
          <span key={k} className="history-field">
            <span className="history-field-name">{k}:</span>{" "}
            <span className="history-field-old">{String(entry.old_data![k] ?? "")}</span>
          </span>
        ))}
      </div>
    );
  }

  return null;
}

export default function HistoryPanel({ tableName, onClose, onRevert }: HistoryPanelProps) {
  const [entries, setEntries] = useState<RowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getTableHistory(tableName, 100, 0);
      setEntries(result);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRevert = async (id: number) => {
    setReverting(id);
    try {
      await api.revertChange(id);
      onRevert();
      await loadHistory();
    } catch (err) {
      console.error("Revert failed:", err);
    } finally {
      setReverting(null);
    }
  };

  return (
    <div className="history-panel">
      <div className="history-header">
        <div className="history-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>History</span>
        </div>
        <button className="history-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="history-body">
        {loading && <div className="history-empty">Loading...</div>}
        {!loading && entries.length === 0 && (
          <div className="history-empty">No changes recorded yet.</div>
        )}
        {!loading && entries.map((entry) => {
          const { label, color } = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "#888" };
          return (
            <div key={entry.id} className="history-entry">
              <div className="history-entry-header">
                <span className="history-action-badge" style={{ background: color }}>
                  {label}
                </span>
                <span className="history-pk">
                  row {entry.row_pk ?? "?"}
                </span>
                <span className="history-time">{formatTime(entry.created_at)}</span>
              </div>
              <ChangeSummary entry={entry} />
              <button
                className="history-revert-btn"
                onClick={() => handleRevert(entry.id)}
                disabled={reverting === entry.id}
              >
                {reverting === entry.id ? "Reverting..." : "Revert"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

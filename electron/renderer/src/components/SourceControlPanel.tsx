import { useState, useEffect, useCallback, useMemo } from "react";
import type { RowHistoryEntry, Commit } from "../data";
import api from "../api";

interface SourceControlPanelProps {
  currentDb: string | null;
  onDataChange: () => void;
}

const ACTION_META: Record<string, { letter: string; label: string; color: string }> = {
  insert: { letter: "A", label: "Added", color: "#73c991" },
  update: { letter: "M", label: "Modified", color: "#e2c08d" },
  delete: { letter: "D", label: "Deleted", color: "#c74e39" },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}m ago`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `${hrs}h ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortHash(id: number): string {
  return String(id).padStart(7, "0");
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function DiffBlock({ entry }: { entry: RowHistoryEntry }) {
  if (entry.action === "insert" && entry.new_data) {
    return (
      <div className="sc-diff">
        {Object.entries(entry.new_data).map(([k, v]) => (
          <div key={k} className="sc-diff-line sc-diff-add">
            <span className="sc-diff-sign">+</span>
            <span className="sc-diff-key">{k}</span>
            <span className="sc-diff-sep">: </span>
            <span className="sc-diff-val">{formatVal(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (entry.action === "delete" && entry.old_data) {
    return (
      <div className="sc-diff">
        {Object.entries(entry.old_data).map(([k, v]) => (
          <div key={k} className="sc-diff-line sc-diff-del">
            <span className="sc-diff-sign">-</span>
            <span className="sc-diff-key">{k}</span>
            <span className="sc-diff-sep">: </span>
            <span className="sc-diff-val">{formatVal(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (entry.action === "update" && entry.old_data && entry.new_data) {
    const allKeys = [...new Set([...Object.keys(entry.old_data), ...Object.keys(entry.new_data)])];
    return (
      <div className="sc-diff">
        {allKeys.map((k) => {
          const oldVal = entry.old_data![k];
          const newVal = entry.new_data![k];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          if (!changed) return null;
          return (
            <div key={k} className="sc-diff-change">
              <div className="sc-diff-line sc-diff-del">
                <span className="sc-diff-sign">-</span>
                <span className="sc-diff-key">{k}</span>
                <span className="sc-diff-sep">: </span>
                <span className="sc-diff-val">{formatVal(oldVal)}</span>
              </div>
              <div className="sc-diff-line sc-diff-add">
                <span className="sc-diff-sign">+</span>
                <span className="sc-diff-key">{k}</span>
                <span className="sc-diff-sep">: </span>
                <span className="sc-diff-val">{formatVal(newVal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

export default function SourceControlPanel({ currentDb, onDataChange }: SourceControlPanelProps) {
  const [uncommitted, setUncommitted] = useState<RowHistoryEntry[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());
  const [expandedCommits, setExpandedCommits] = useState<Set<number>>(new Set());
  const [commitChanges, setCommitChanges] = useState<Record<number, RowHistoryEntry[]>>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentDb) {
      setUncommitted([]);
      setCommits([]);
      return;
    }
    try {
      const [uc, cl] = await Promise.all([
        api.getUncommittedChanges(),
        api.listCommits(100, 0),
      ]);
      setUncommitted(uc);
      setCommits(cl);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [currentDb]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload when database changes externally
  useEffect(() => {
    if (!currentDb) return;
    const cleanup = api.onExternalChange(() => loadData());
    return cleanup;
  }, [currentDb, loadData]);

  const handleCommit = async () => {
    const msg = commitMessage.trim();
    if (!msg) return;
    setCommitting(true);
    setError(null);
    try {
      await api.createCommit(msg);
      setCommitMessage("");
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setCommitting(false);
    }
  };

  const handleRevertToCommit = async (commitId: number) => {
    if (reverting !== null) return;
    if (!confirm("Revert to this commit? All changes after it will be undone.")) return;
    setReverting(commitId);
    setError(null);
    try {
      await api.revertToCommit(commitId);
      await loadData();
      onDataChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setReverting(null);
    }
  };

  const toggleChange = (id: number) => {
    setExpandedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCommit = async (id: number) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Lazy-load commit changes
    if (!commitChanges[id]) {
      try {
        const changes = await api.getCommitChanges(id);
        setCommitChanges((prev) => ({ ...prev, [id]: changes }));
      } catch (err) {
        // Store empty array so it doesn't retry and show "Loading..." forever
        setCommitChanges((prev) => ({ ...prev, [id]: [] }));
        setError(`Failed to load commit changes: ${err}`);
      }
    }
  };

  // Group uncommitted changes by table
  const groupedUncommitted = useMemo(() => {
    const groups: Record<string, RowHistoryEntry[]> = {};
    for (const entry of uncommitted) {
      const key = entry.table;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return groups;
  }, [uncommitted]);

  if (!currentDb) {
    return (
      <div className="sc-panel">
        <div className="sc-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="1" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>Select a database to view history</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-panel">
      {/* Commit input */}
      <div className="sc-commit-box">
        <input
          type="text"
          className="sc-commit-input"
          placeholder="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); }}
          disabled={committing || uncommitted.length === 0}
        />
        <button
          className="sc-commit-btn"
          onClick={handleCommit}
          disabled={committing || !commitMessage.trim() || uncommitted.length === 0}
          title={uncommitted.length === 0 ? "No uncommitted changes" : "Commit changes"}
        >
          {committing ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="sc-spin">
              <path d="M4.681 3A5.5 5.5 0 0 1 8 2a5.5 5.5 0 0 1 5.5 5.5.75.75 0 0 0 1.5 0A7 7 0 0 0 4.393 1.607L3.5.714V3h1.181z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          Commit
        </button>
      </div>

      {error && <div className="sc-error">{error}</div>}

      <div className="sc-body">
        {/* Uncommitted Changes */}
        <div className="sc-section">
          <div className="sc-section-header">
            <span className="sc-section-label">CHANGES</span>
            {uncommitted.length > 0 && (
              <span className="sc-badge">{uncommitted.length}</span>
            )}
          </div>
          {uncommitted.length === 0 ? (
            <div className="sc-empty-hint">No uncommitted changes</div>
          ) : (
            Object.entries(groupedUncommitted).map(([table, entries]) => (
              <div key={table} className="sc-table-group">
                <div className="sc-table-name">{table}</div>
                {entries.map((entry) => {
                  const meta = ACTION_META[entry.action];
                  const isExpanded = expandedChanges.has(entry.id);
                  return (
                    <div key={entry.id} className="sc-change">
                      <div className="sc-change-row" onClick={() => toggleChange(entry.id)}>
                        <span className="sc-change-expand">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                        <span className="sc-change-letter" style={{ color: meta.color }}>{meta.letter}</span>
                        <span className="sc-change-desc">
                          {meta.label} <span className="sc-change-pk">#{entry.row_pk ?? "?"}</span>
                        </span>
                        <span className="sc-change-time">{formatTimestamp(entry.created_at)}</span>
                      </div>
                      {isExpanded && <DiffBlock entry={entry} />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Commit Log */}
        <div className="sc-section">
          <div className="sc-section-header">
            <span className="sc-section-label">COMMITS</span>
            {commits.length > 0 && (
              <span className="sc-badge">{commits.length}</span>
            )}
          </div>
          {commits.length === 0 ? (
            <div className="sc-empty-hint">No commits yet</div>
          ) : (
            commits.map((commit) => {
              const isExpanded = expandedCommits.has(commit.id);
              const changes = commitChanges[commit.id] ?? [];
              return (
                <div key={commit.id} className="sc-commit-entry">
                  <div className="sc-commit-row" onClick={() => toggleCommit(commit.id)}>
                    <span className="sc-change-expand">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                    <div className="sc-commit-info">
                      <div className="sc-commit-msg">{commit.message}</div>
                      <div className="sc-commit-meta">
                        <span className="sc-commit-hash">{shortHash(commit.id)}</span>
                        <span className="sc-commit-date">{formatTimestamp(commit.created_at)}</span>
                        <span className="sc-commit-count">{commit.change_count} change{commit.change_count !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <button
                      className="sc-revert-btn"
                      onClick={(e) => { e.stopPropagation(); handleRevertToCommit(commit.id); }}
                      disabled={reverting !== null}
                      title="Revert to this commit"
                    >
                      {reverting === commit.id ? (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="sc-spin">
                          <path d="M4.681 3A5.5 5.5 0 0 1 8 2a5.5 5.5 0 0 1 5.5 5.5.75.75 0 0 0 1.5 0A7 7 0 0 0 4.393 1.607L3.5.714V3h1.181z"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="M3.5 2v3.5L6 3H4.393A7 7 0 0 1 15 7.5a.75.75 0 0 1-1.5 0A5.5 5.5 0 0 0 4.681 3H3.5zm9 10.5V9L10 12.5h1.607A7 7 0 0 1 1 8.5a.75.75 0 0 1 1.5 0 5.5 5.5 0 0 0 8.82 4.5H12.5z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {isExpanded && changes.length > 0 && (
                    <div className="sc-commit-changes">
                      {changes.map((entry) => {
                        const meta = ACTION_META[entry.action];
                        const isChangeExpanded = expandedChanges.has(entry.id);
                        return (
                          <div key={entry.id} className="sc-change">
                            <div className="sc-change-row sc-change-nested" onClick={() => toggleChange(entry.id)}>
                              <span className="sc-change-expand">{isChangeExpanded ? "\u25BC" : "\u25B6"}</span>
                              <span className="sc-change-letter" style={{ color: meta.color }}>{meta.letter}</span>
                              <span className="sc-change-desc">
                                {entry.table} <span className="sc-change-pk">#{entry.row_pk ?? "?"}</span>
                              </span>
                            </div>
                            {isChangeExpanded && <DiffBlock entry={entry} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isExpanded && changes.length === 0 && (
                    <div className="sc-empty-hint" style={{ paddingLeft: 24 }}>Loading...</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

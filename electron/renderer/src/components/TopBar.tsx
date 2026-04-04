import { useState } from "react";
import type { ViewType, ActiveItem } from "../data";

interface TopBarProps {
  activeItem: ActiveItem;
  loading: boolean;
  onViewChange: (view: ViewType) => void;
  onCreateQueryPage: (name: string, sql: string, viewType: string) => void;
  onRefresh: () => void;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
}

const VIEW_OPTIONS: { type: ViewType; label: string; icon: JSX.Element }[] = [
  {
    type: "table",
    label: "Table",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3v18" />
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M21 9H3" />
        <path d="M21 15H3" />
      </svg>
    ),
  },
  {
    type: "kanban",
    label: "Board",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M8 7v7" />
        <path d="M12 7v4" />
        <path d="M16 7v9" />
      </svg>
    ),
  },
  {
    type: "calendar",
    label: "Calendar",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

export default function TopBar({ activeItem, loading, onViewChange, onCreateQueryPage, onRefresh, historyOpen, onToggleHistory }: TopBarProps) {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError("View name is required");
      return;
    }
    setSaveError(null);
    onCreateQueryPage(trimmed, activeItem.sql, activeItem.viewType);
    setSaveName("");
    setShowSaveInput(false);
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{activeItem.name}</span>
        <span className="topbar-kind">{activeItem.kind === "table" ? "table" : activeItem.viewType}</span>

        <div role="group" aria-label="View type" className="topbar-tabs">
          {VIEW_OPTIONS.map(({ type, label, icon }) => (
            <button
              key={type}
              aria-pressed={activeItem.viewType === type}
              className={`tab ${activeItem.viewType === type ? "active" : ""}`}
              onClick={() => onViewChange(type)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="topbar-right">
        {onToggleHistory && (
          <button className={`action-btn ${historyOpen ? "active" : ""}`} onClick={onToggleHistory} title="Row history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>
        )}
        <button
          className="action-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          aria-label="Refresh data"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>

        {activeItem.kind === "table" && !showSaveInput && (
          <button
            className="action-btn"
            onClick={() => { setShowSaveInput(true); setSaveError(null); }}
            disabled={loading}
            aria-label="Save view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save View
          </button>
        )}

        {showSaveInput && (
          <div className="topbar-save-input">
            <input
              type="text"
              className={`sidebar-inline-input ${saveError ? "input-error" : ""}`}
              placeholder="View name..."
              value={saveName}
              onChange={(e) => { setSaveName(e.target.value); setSaveError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") { setShowSaveInput(false); setSaveError(null); }
              }}
              autoFocus
            />
            {saveError && <div className="validation-error">{saveError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

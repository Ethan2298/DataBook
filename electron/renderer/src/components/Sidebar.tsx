import { useState, useEffect } from "react";
import type { QueryPage, ActiveItem } from "../data";

interface SidebarProps {
  databases: string[];
  currentDb: string | null;
  queryPages: QueryPage[];
  activeItem: ActiveItem | null;
  onSelectDb: (name: string) => void;
  onCreateDb: (name: string) => void;
  onDeleteDb: (name: string) => void;
  onSelectQueryPage: (page: QueryPage) => void;
  onDeleteQueryPage: (name: string) => void;
}

export default function Sidebar({
  databases,
  currentDb,
  queryPages,
  activeItem,
  onSelectDb,
  onCreateDb,
  onDeleteDb,
  onSelectQueryPage,
  onDeleteQueryPage,
}: SidebarProps) {
  const [showDbInput, setShowDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ type: string; name: string; x: number; y: number } | null>(null);

  const handleCreateDb = () => {
    if (newDbName.trim()) {
      onCreateDb(newDbName.trim());
      setNewDbName("");
      setShowDbInput(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, type: string, name: string) => {
    e.preventDefault();
    setContextMenu({ type, name, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeContextMenu();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  return (
    <aside className="sidebar">
      {/* Query Pages / Views */}
      {currentDb && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">VIEWS</span>
          </div>
          {queryPages.map((p) => (
            <div
              key={p.id}
              className={`sidebar-item ${activeItem?.kind === "query_page" && activeItem.name === p.name ? "active" : ""}`}
              onClick={() => onSelectQueryPage(p)}
              onContextMenu={(e) => handleContextMenu(e, "query_page", p.name)}
            >
              <span className="sidebar-view-icon">#</span>
              <span>{p.name}</span>
              <span className="sidebar-view-type">{p.view_type}</span>
            </div>
          ))}
          {queryPages.length === 0 && (
            <div className="sidebar-empty">No saved views</div>
          )}
        </div>
      )}

      <div className="sidebar-spacer" />

      {/* Database selector */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">DATABASE</span>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowDbInput(!showDbInput)}
            title="New database"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {showDbInput && (
          <div className="sidebar-input-row">
            <input
              type="text"
              className="sidebar-inline-input"
              placeholder="database name..."
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDb();
                if (e.key === "Escape") setShowDbInput(false);
              }}
              autoFocus
            />
          </div>
        )}

        {databases.map((db) => (
          <div
            key={db}
            className={`sidebar-item ${currentDb === db ? "active" : ""}`}
            onClick={() => onSelectDb(db)}
            onContextMenu={(e) => handleContextMenu(e, "database", db)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <span>{db}</span>
          </div>
        ))}

        {databases.length === 0 && !showDbInput && (
          <div className="sidebar-empty">No databases yet</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item danger"
            onClick={() => {
              if (contextMenu.type === "database") onDeleteDb(contextMenu.name);
              else if (contextMenu.type === "query_page") onDeleteQueryPage(contextMenu.name);
              closeContextMenu();
            }}
          >
            Delete {contextMenu.type === "query_page" ? "view" : contextMenu.type}
          </button>
        </div>
      )}
    </aside>
  );
}

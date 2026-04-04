import { useState, useEffect } from "react";
import type { QueryPage, ActiveItem } from "../data";

interface SidebarProps {
  databases: string[];
  currentDb: string | null;
  tables: string[];
  queryPages: QueryPage[];
  activeItem: ActiveItem | null;
  loading: boolean;
  onSelectDb: (name: string) => void;
  onCreateDb: (name: string) => void;
  onDeleteDb: (name: string) => void;
  onSelectTable: (name: string) => void;
  onDropTable: (name: string) => void;
  onSelectQueryPage: (page: QueryPage) => void;
  onDeleteQueryPage: (name: string) => void;
}

export default function Sidebar({
  databases,
  currentDb,
  tables,
  queryPages,
  activeItem,
  loading,
  onSelectDb,
  onCreateDb,
  onDeleteDb,
  onSelectTable,
  onDropTable,
  onSelectQueryPage,
  onDeleteQueryPage,
}: SidebarProps) {
  const [showDbInput, setShowDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [dbNameError, setDbNameError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ type: string; name: string; x: number; y: number } | null>(null);

  const handleCreateDb = () => {
    const trimmed = newDbName.trim();
    if (!trimmed) {
      setDbNameError("Database name is required");
      return;
    }
    if (databases.includes(trimmed)) {
      setDbNameError("A database with this name already exists");
      return;
    }
    setDbNameError(null);
    onCreateDb(trimmed);
    setNewDbName("");
    setShowDbInput(false);
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

  const handleItemKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (loading) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  return (
    <aside className={`sidebar ${loading ? "sidebar-disabled" : ""}`}>
      {/* Tables */}
      {currentDb && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">TABLES</span>
          </div>
          {tables.map((t) => {
            const isActive = activeItem?.kind === "table" && activeItem.name === t;
            return (
              <div
                key={t}
                role="button"
                tabIndex={0}
                className={`sidebar-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectTable(t)}
                onKeyDown={(e) => handleItemKeyDown(e, () => onSelectTable(t))}
                onContextMenu={(e) => handleContextMenu(e, "table", t)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
                <span>{t}</span>
              </div>
            );
          })}
          {tables.length === 0 && (
            <div className="sidebar-empty">No tables yet</div>
          )}
        </div>
      )}

      {/* Query Pages / Views */}
      {currentDb && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-label">VIEWS</span>
          </div>
          {queryPages.map((p) => {
            const isActive = activeItem?.kind === "query_page" && activeItem.name === p.name;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className={`sidebar-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectQueryPage(p)}
                onKeyDown={(e) => handleItemKeyDown(e, () => onSelectQueryPage(p))}
                onContextMenu={(e) => handleContextMenu(e, "query_page", p.name)}
              >
                <span className="sidebar-view-icon">#</span>
                <span>{p.name}</span>
                <span className="sidebar-view-type">{p.view_type}</span>
              </div>
            );
          })}
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
            onClick={() => { setShowDbInput(!showDbInput); setDbNameError(null); }}
            title="New database"
            aria-label="New database"
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
              className={`sidebar-inline-input ${dbNameError ? "input-error" : ""}`}
              placeholder="database name..."
              value={newDbName}
              onChange={(e) => { setNewDbName(e.target.value); setDbNameError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDb();
                if (e.key === "Escape") { setShowDbInput(false); setDbNameError(null); }
              }}
              autoFocus
            />
            {dbNameError && <div className="validation-error">{dbNameError}</div>}
          </div>
        )}

        {databases.map((db) => {
          const isActive = currentDb === db;
          return (
            <div
              key={db}
              role="button"
              tabIndex={0}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectDb(db)}
              onKeyDown={(e) => handleItemKeyDown(e, () => onSelectDb(db))}
              onContextMenu={(e) => handleContextMenu(e, "database", db)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>{db}</span>
            </div>
          );
        })}

        {databases.length === 0 && !showDbInput && (
          <div className="sidebar-empty">No databases yet</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <button
            className="context-menu-item danger"
            role="menuitem"
            onClick={() => {
              if (contextMenu.type === "database") onDeleteDb(contextMenu.name);
              else if (contextMenu.type === "table") onDropTable(contextMenu.name);
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

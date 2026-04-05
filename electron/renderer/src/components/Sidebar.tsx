import { useState, useEffect } from "react";
import type { QueryPage, ActiveItem } from "../data";
import SourceControlPanel from "./SourceControlPanel";

type SidebarTab = "explorer" | "source-control";

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
  onCreateQueryPage: (name: string, sql: string, viewType: string) => void;
  onDataChange: () => void;
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
  onCreateQueryPage,
  onDataChange,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("explorer");
  const [showDbInput, setShowDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [dbNameError, setDbNameError] = useState<string | null>(null);
  const [showViewInput, setShowViewInput] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [viewNameError, setViewNameError] = useState<string | null>(null);
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

  const handleCreateView = () => {
    const trimmed = newViewName.trim();
    if (!trimmed) {
      setViewNameError("View name is required");
      return;
    }
    if (queryPages.some((p) => p.name === trimmed)) {
      setViewNameError("A view with this name already exists");
      return;
    }
    if (!activeItem) {
      setViewNameError("Select a table first");
      return;
    }
    setViewNameError(null);
    onCreateQueryPage(trimmed, activeItem.sql, activeItem.viewType);
    setNewViewName("");
    setShowViewInput(false);
  };

  const handleContextMenu = (e: React.MouseEvent, type: string, name: string) => {
    e.preventDefault();
    setContextMenu({ type, name, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

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
      {activeTab === "explorer" ? (
        <>
          {/* Query Pages / Views */}
          {currentDb && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-label">VIEWS</span>
                <button
                  className="sidebar-add-btn"
                  onClick={() => { setShowViewInput(!showViewInput); setViewNameError(null); }}
                  title="New view"
                  aria-label="New view"
                  disabled={!activeItem}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
              {showViewInput && (
                <div className="sidebar-input-row">
                  <input
                    type="text"
                    className={`sidebar-inline-input ${viewNameError ? "input-error" : ""}`}
                    placeholder="view name..."
                    value={newViewName}
                    onChange={(e) => { setNewViewName(e.target.value); setViewNameError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateView();
                      if (e.key === "Escape") { setShowViewInput(false); setViewNameError(null); }
                    }}
                    autoFocus
                  />
                  {viewNameError && <div className="validation-error">{viewNameError}</div>}
                </div>
              )}
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
                  </div>
                );
              })}
              {queryPages.length === 0 && !showViewInput && (
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
        </>
      ) : (
        <SourceControlPanel currentDb={currentDb} onDataChange={onDataChange} />
      )}

      {/* Bottom tab switcher */}
      <div className="sidebar-tab-bar">
        <button
          className={`sidebar-tab-btn ${activeTab === "explorer" ? "active" : ""}`}
          onClick={() => setActiveTab("explorer")}
          title="Explorer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Explorer
        </button>
        <button
          className={`sidebar-tab-btn ${activeTab === "source-control" ? "active" : ""}`}
          onClick={() => setActiveTab("source-control")}
          title="Source Control"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 0 0 9 9" />
          </svg>
          History
        </button>
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

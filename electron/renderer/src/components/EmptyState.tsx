import { useState } from "react";

interface EmptyStateProps {
  hasDb: boolean;
  hasTables: boolean;
  onCreateDb: (name: string) => void;
  onCreateTable: (name: string, columns: { name: string; type: string }[]) => void;
}

export default function EmptyState({ hasDb, hasTables, onCreateDb, onCreateTable }: EmptyStateProps) {
  const [dbName, setDbName] = useState("");
  const [tableName, setTableName] = useState("");
  const [showTableForm, setShowTableForm] = useState(false);
  const [newCols, setNewCols] = useState([
    { name: "id", type: "INTEGER" },
    { name: "name", type: "TEXT" },
  ]);

  const handleCreateDb = () => {
    if (dbName.trim()) {
      onCreateDb(dbName.trim());
      setDbName("");
    }
  };

  const handleCreateTable = () => {
    if (tableName.trim() && newCols.length > 0) {
      onCreateTable(tableName.trim(), newCols);
      setTableName("");
      setShowTableForm(false);
      setNewCols([{ name: "id", type: "INTEGER" }, { name: "name", type: "TEXT" }]);
    }
  };

  const addColumn = () => {
    setNewCols([...newCols, { name: "", type: "TEXT" }]);
  };

  if (!hasDb) {
    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <h2 className="empty-title">Create your first database</h2>
          <p className="empty-subtitle">DataBook stores data in SQLite databases. Create one to get started, or use the MCP server to let AI manage your data.</p>
          <div className="empty-form">
            <input
              type="text"
              className="empty-input"
              placeholder="Database name..."
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateDb()}
            />
            <button className="empty-btn" onClick={handleCreateDb} disabled={!dbName.trim()}>
              Create Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasTables || showTableForm) {
    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3v18" />
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M21 9H3" />
            <path d="M21 15H3" />
          </svg>
          <h2 className="empty-title">{hasTables ? "Create a table" : "Add your first table"}</h2>
          <p className="empty-subtitle">Define columns for your table. You can also use the MCP server to create tables with AI.</p>
          <div className="empty-form">
            <input
              type="text"
              className="empty-input"
              placeholder="Table name..."
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
            <div className="empty-columns">
              {newCols.map((col, i) => (
                <div key={i} className="empty-col-row">
                  <input
                    type="text"
                    className="empty-col-input"
                    placeholder="Column name"
                    value={col.name}
                    onChange={(e) => {
                      const updated = [...newCols];
                      updated[i] = { ...col, name: e.target.value };
                      setNewCols(updated);
                    }}
                  />
                  <select
                    className="empty-col-select"
                    value={col.type}
                    onChange={(e) => {
                      const updated = [...newCols];
                      updated[i] = { ...col, type: e.target.value };
                      setNewCols(updated);
                    }}
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="REAL">REAL</option>
                    <option value="BLOB">BLOB</option>
                  </select>
                  {newCols.length > 1 && (
                    <button
                      className="empty-col-remove"
                      onClick={() => setNewCols(newCols.filter((_, j) => j !== i))}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button className="empty-add-col" onClick={addColumn}>+ Add column</button>
            </div>
            <button className="empty-btn" onClick={handleCreateTable} disabled={!tableName.trim()}>
              Create Table
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <h2 className="empty-title">Select a table or view</h2>
        <p className="empty-subtitle">Pick a table from the sidebar to view its data, or use the MCP server to manage your databases with AI.</p>
      </div>
    </div>
  );
}

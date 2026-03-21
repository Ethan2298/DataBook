export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" placeholder="Search..." />
      </div>

      <div className="sidebar-pages">
        <div className="sidebar-item active">
          <span className="hash">#</span>
          <span>Overdue Tasks</span>
        </div>
        <div className="sidebar-item">
          <span className="hash">#</span>
          <span>Completed This Week</span>
        </div>
        <div className="sidebar-item">
          <span className="hash">#</span>
          <span>Tasks by Priority</span>
        </div>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-databases">
        <span className="sidebar-db-icon">✅</span>
        <span className="sidebar-db-icon">🎯</span>
        <span className="sidebar-db-icon">📝</span>
      </div>
    </aside>
  );
}

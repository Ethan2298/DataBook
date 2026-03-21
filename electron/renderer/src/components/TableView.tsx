import Badge from "./Badge";
import type { Task } from "../data";

interface TableViewProps {
  tasks: Task[];
}

export default function TableView({ tasks }: TableViewProps) {
  return (
    <div className="view-table">
      <div className="table-header">
        <div className="col col-check">
          <input type="checkbox" className="checkbox" />
        </div>
        <div className="col col-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="14" y2="12" />
            <line x1="4" y1="18" x2="18" y2="18" />
          </svg>
          Title
        </div>
        <div className="col col-priority">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 15 12 9 18 15" />
          </svg>
          Priority
        </div>
        <div className="col col-status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
          </svg>
          Status
        </div>
        <div className="col col-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
          Due Date
        </div>
      </div>

      <div className="table-body">
        {tasks.map((row) => (
          <div key={row.id} className="table-row">
            <div className="col col-check"><input type="checkbox" className="checkbox" /></div>
            <div className="col col-title"><span className="col-title-text">{row.title}</span></div>
            <div className="col col-priority"><Badge dot={row.priorityDot} label={row.priority} /></div>
            <div className="col col-status"><Badge dot={row.statusDot} label={row.status} /></div>
            <div className="col col-date"><span className="col-date-text">{row.date}</span></div>
          </div>
        ))}

        <div className="new-row">
          <div className="new-row-inner">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            New
          </div>
        </div>
      </div>

      <div className="footer">
        <span className="footer-label">COUNT</span>
        <span className="footer-value">{tasks.length}</span>
      </div>
    </div>
  );
}

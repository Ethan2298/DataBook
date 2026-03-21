import { useState } from "react";
import Badge from "./Badge";
import type { Task } from "../data";

interface CalendarViewProps {
  tasks: Task[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const MONTH_ABBRS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseTaskDate(dateStr: string): Date | null {
  // Format: "Mar 12, 2025"
  const match = dateStr.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_ABBRS[match[1]];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[2]));
}

function getCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: Date[][] = [];
  const current = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function tasksForDate(tasks: Task[], date: Date): Task[] {
  return tasks.filter((t) => {
    const d = parseTaskDate(t.date);
    return (
      d !== null &&
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  });
}

export default function CalendarView({ tasks }: CalendarViewProps) {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(2); // March (0-indexed)

  const weeks = getCalendarWeeks(year, month);

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="view-calendar">
      <div className="calendar-month-header">
        <button className="calendar-today-btn" onClick={goToToday}>
          Today
        </button>
        <div className="calendar-month-nav">
          <button className="calendar-nav" onClick={prevMonth}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="calendar-nav" onClick={nextMonth}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <span className="calendar-month-title">
          {MONTH_NAMES[month]} {year}
        </span>
      </div>

      <div className="calendar-day-headers">
        {DAY_LABELS.map((d) => (
          <div key={d} className="calendar-day-label">{d}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-week">
            {week.map((date, di) => {
              const isOutside = date.getMonth() !== month;
              const dayTasks = tasksForDate(tasks, date);
              return (
                <div
                  key={di}
                  className={`calendar-cell${isOutside ? " outside" : ""}`}
                >
                  <div className="calendar-cell-header">
                    <button className="calendar-add-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className="calendar-date-number">
                      {date.getDate()}
                    </span>
                  </div>
                  {dayTasks.map((t) => (
                    <div key={t.id} className="calendar-task">
                      <span className="calendar-task-title">{t.title}</span>
                      <div className="calendar-task-chips">
                        <Badge dot={t.priorityDot} label={t.priority} className="calendar-badge" />
                        <Badge dot={t.statusDot} label={t.status} className="calendar-badge" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

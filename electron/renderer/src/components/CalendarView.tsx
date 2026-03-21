import { useState, useMemo } from "react";
import type { Row } from "../data";

interface CalendarViewProps {
  rows: Row[];
  dateCol: string;
  titleCol: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  const s = String(val);

  // ISO: 2025-03-12
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // "Mar 12, 2025" style
  const MONTH_ABBRS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const abbr = s.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (abbr && MONTH_ABBRS[abbr[1]] !== undefined) {
    return new Date(Number(abbr[3]), MONTH_ABBRS[abbr[1]], Number(abbr[2]));
  }

  // Fallback: try Date constructor
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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

export default function CalendarView({ rows, dateCol, titleCol }: CalendarViewProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const weeks = getCalendarWeeks(year, month);

  // Build date → rows map
  const dateMap = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const d = parseDate(row[dateCol]);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return map;
  }, [rows, dateCol]);

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="view-calendar">
      <div className="calendar-month-header">
        <button className="calendar-today-btn" onClick={goToToday}>Today</button>
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
        <span className="calendar-month-title">{MONTH_NAMES[month]} {year}</span>
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
              const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const dayRows = dateMap.get(key) ?? [];
              return (
                <div key={di} className={`calendar-cell${isOutside ? " outside" : ""}`}>
                  <div className="calendar-cell-header">
                    <span className="calendar-date-number">{date.getDate()}</span>
                  </div>
                  {dayRows.map((row, ri) => (
                    <div key={ri} className="calendar-task">
                      <span className="calendar-task-title">{String(row[titleCol] ?? "")}</span>
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

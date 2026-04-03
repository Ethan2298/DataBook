import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Row, ColumnInfo, ColumnOptionsMap } from "../data";
import DetailPanel from "./DetailPanel";

interface CalendarViewProps {
  rows: Row[];
  dateCol: string;
  titleCol: string;
  columnOptions?: ColumnOptionsMap;
  statusCol?: string | null;
  tableName?: string;
  columns?: ColumnInfo[];
  onInsertRow?: (row: Row) => void;
  onUpdateRow?: (pkCol: string, pkVal: unknown, updates: Row) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const DEFAULT_EVENT_COLOR = "#555";

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

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Find primary key column from columns list */
function findPkCol(columns: ColumnInfo[]): string | null {
  const pk = columns.find((c) => c.pk === 1);
  return pk ? pk.name : null;
}

/** Get event color based on status value */
function getEventColor(
  row: Row,
  statusCol: string | null | undefined,
  statusOptions: { value: string; color: string }[] | undefined,
): string {
  if (!statusCol || !statusOptions || statusOptions.length === 0) return DEFAULT_EVENT_COLOR;
  const val = String(row[statusCol] ?? "");
  const opt = statusOptions.find((o) => o.value === val);
  return opt ? opt.color : DEFAULT_EVENT_COLOR;
}

/* ── Inline add input ── */
function InlineAddInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const val = inputRef.current?.value.trim();
      if (val) onSubmit(val);
      else onCancel();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="calendar-inline-input"
      placeholder="New event..."
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  );
}

/* ── Main component ── */
export default function CalendarView({
  rows,
  dateCol,
  titleCol,
  columnOptions,
  statusCol,
  tableName,
  columns,
  onInsertRow,
  onUpdateRow,
}: CalendarViewProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [addingCell, setAddingCell] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<Row | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const weeks = getCalendarWeeks(year, month);

  // Resolve status column options
  const statusOptions = useMemo(() => {
    if (!statusCol || !columnOptions || !tableName) return undefined;
    const key = `${tableName}.${statusCol}`;
    return columnOptions[key];
  }, [statusCol, columnOptions, tableName]);

  const pkCol = useMemo(() => {
    if (!columns) return null;
    return findPkCol(columns);
  }, [columns]);

  // Build date -> rows map
  const dateMap = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const d = parseDate(row[dateCol]);
      if (!d) continue;
      const key = dateKey(d);
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

  const toggleExpand = useCallback((key: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCellClick = useCallback(
    (e: React.MouseEvent, key: string) => {
      // Only trigger on clicks directly on the cell or cell-header area, not on events
      if (!onInsertRow) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(".calendar-task") ||
        target.closest(".calendar-more-btn") ||
        target.closest(".calendar-inline-input")
      ) {
        return;
      }
      setAddingCell(key);
    },
    [onInsertRow],
  );

  const handleInlineSubmit = useCallback(
    (key: string, date: Date, value: string) => {
      if (!onInsertRow) return;
      onInsertRow({ [dateCol]: formatDateISO(date), [titleCol]: value });
      setAddingCell(null);
    },
    [onInsertRow, dateCol, titleCol],
  );

  const handleEventClick = useCallback((e: React.MouseEvent, row: Row) => {
    e.stopPropagation();
    setSelectedRow(row);
  }, []);

  // ── Drag and drop ──
  const handleDragStart = useCallback((e: React.DragEvent, row: Row) => {
    setDragRow(row);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox
    e.dataTransfer.setData("text/plain", "");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      if (!dragRow || !onUpdateRow || !pkCol) {
        setDragRow(null);
        return;
      }
      const newDateStr = formatDateISO(targetDate);
      const currentDateStr = (() => {
        const d = parseDate(dragRow[dateCol]);
        return d ? formatDateISO(d) : null;
      })();

      if (newDateStr !== currentDateStr) {
        onUpdateRow(pkCol, dragRow[pkCol], { [dateCol]: newDateStr });
      }
      setDragRow(null);
    },
    [dragRow, onUpdateRow, pkCol, dateCol],
  );

  const handleDragEnd = useCallback(() => {
    setDragRow(null);
  }, []);

  const MAX_VISIBLE = 3;
  const OVERFLOW_VISIBLE = 2;

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
              const key = dateKey(date);
              const dayRows = dateMap.get(key) ?? [];
              const isExpanded = expandedCells.has(key);
              const hasOverflow = dayRows.length > MAX_VISIBLE;
              const visibleRows = hasOverflow && !isExpanded
                ? dayRows.slice(0, OVERFLOW_VISIBLE)
                : dayRows;
              const hiddenCount = dayRows.length - OVERFLOW_VISIBLE;
              const canDrag = !!onUpdateRow && !!pkCol;

              return (
                <div
                  key={di}
                  className={`calendar-cell${isOutside ? " outside" : ""}`}
                  onClick={(e) => handleCellClick(e, key)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, date)}
                >
                  <div className="calendar-cell-header">
                    <span className="calendar-date-number">{date.getDate()}</span>
                  </div>
                  {visibleRows.map((row, ri) => {
                    const color = getEventColor(row, statusCol, statusOptions);
                    return (
                      <div
                        key={ri}
                        className="calendar-task"
                        style={{ borderLeft: `3px solid ${color}` }}
                        onClick={(e) => handleEventClick(e, row)}
                        draggable={canDrag}
                        onDragStart={canDrag ? (e) => handleDragStart(e, row) : undefined}
                        onDragEnd={canDrag ? handleDragEnd : undefined}
                      >
                        <span className="calendar-task-title">{String(row[titleCol] ?? "")}</span>
                      </div>
                    );
                  })}
                  {hasOverflow && !isExpanded && (
                    <button
                      className="calendar-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(key);
                      }}
                    >
                      +{hiddenCount} more
                    </button>
                  )}
                  {hasOverflow && isExpanded && (
                    <button
                      className="calendar-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(key);
                      }}
                    >
                      show less
                    </button>
                  )}
                  {addingCell === key && (
                    <InlineAddInput
                      onSubmit={(val) => handleInlineSubmit(key, date, val)}
                      onCancel={() => setAddingCell(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <DetailPanel
        row={selectedRow}
        columns={columns ?? []}
        columnOptions={columnOptions ?? {}}
        tableName={tableName ?? ""}
        onClose={() => setSelectedRow(null)}
        onUpdateRow={onUpdateRow}
      />
    </div>
  );
}

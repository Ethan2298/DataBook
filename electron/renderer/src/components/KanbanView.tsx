import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Row, ColumnInfo, ColumnOptionsMap } from "../data";
import DetailPanel from "./DetailPanel";

interface KanbanViewProps {
  rows: Row[];
  groupByCol: string;
  titleCol: string;
  columns: string[];
  pkCol?: string;
  tableName?: string;
  columnOptions?: ColumnOptionsMap;
  columnInfos?: ColumnInfo[];
  onUpdateRow?: (pkCol: string, pkVal: unknown, updates: Row) => void;
  onInsertRow?: (row: Row) => void;
}

const COLORS = [
  { bg: "rgba(217, 115, 13, 0.06)", card: "rgba(217, 115, 13, 0.12)", border: "rgba(217, 115, 13, 0.2)", dot: "#D9730D" },
  { bg: "rgba(35, 131, 226, 0.06)", card: "rgba(35, 131, 226, 0.12)", border: "rgba(35, 131, 226, 0.2)", dot: "#2383E2" },
  { bg: "rgba(77, 171, 111, 0.06)", card: "rgba(77, 171, 111, 0.12)", border: "rgba(77, 171, 111, 0.2)", dot: "#4DAB6F" },
  { bg: "rgba(224, 62, 62, 0.06)", card: "rgba(224, 62, 62, 0.12)", border: "rgba(224, 62, 62, 0.2)", dot: "#E03E3E" },
  { bg: "rgba(155, 154, 151, 0.06)", card: "rgba(155, 154, 151, 0.12)", border: "rgba(155, 154, 151, 0.2)", dot: "#9B9A97" },
  { bg: "rgba(105, 64, 165, 0.06)", card: "rgba(105, 64, 165, 0.12)", border: "rgba(105, 64, 165, 0.2)", dot: "#6940A5" },
];

/** Convert a hex color to an rgba color-scheme object for cards/bg/border. */
function colorFromHex(hex: string): typeof COLORS[0] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.06)`,
    card: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.2)`,
    dot: hex,
  };
}

function KanbanCard({ row, titleCol, columns, color }: { row: Row; titleCol: string; columns: string[]; color: typeof COLORS[0] }) {
  const metaCols = columns.filter((c) => c !== titleCol);
  return (
    <div className="kanban-card" style={{ background: color.card, borderColor: color.border }}>
      <span className="kanban-card-title">{String(row[titleCol] ?? "")}</span>
      {metaCols.length > 0 && (
        <div className="kanban-card-meta">
          {metaCols.slice(0, 3).map((col) => (
            <span key={col} className="kanban-card-date">{String(row[col] ?? "")}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableCard({ row, titleCol, columns, color, id, onClick }: { row: Row; titleCol: string; columns: string[]; color: typeof COLORS[0]; id: string; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
  };

  // Track pointer position to distinguish click from drag
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    // Call dnd-kit's listener
    (listeners as Record<string, (e: React.PointerEvent) => void>)?.onPointerDown?.(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only fire if the pointer didn't move far (not a drag)
    if (pointerStart.current) {
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      if (dx < 5 && dy < 5 && onClick) {
        onClick();
      }
    }
    pointerStart.current = null;
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onPointerDown={handlePointerDown} onClick={handleClick}>
      <KanbanCard row={row} titleCol={titleCol} columns={columns} color={color} />
    </div>
  );
}

function InlineAddCard({
  color,
  onAdd,
}: {
  color: typeof COLORS[0];
  onAdd: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onAdd(trimmed);
    setText("");
    setEditing(false);
  };

  const cancel = () => {
    setText("");
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: "0 2px" }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={cancel}
          placeholder="Enter title..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: color.card,
            border: `1px solid ${color.border}`,
            borderRadius: 6,
            padding: "8px 10px",
            color: "#ebebeb",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="kanban-add-btn"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      New
    </button>
  );
}

function DroppableColumn({
  groupValue,
  ids,
  color,
  count,
  collapsed,
  onToggleCollapse,
  children,
  addCard,
}: {
  groupValue: string;
  ids: string[];
  color: typeof COLORS[0];
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
  addCard?: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${groupValue}` });

  return (
    <div ref={setNodeRef} className="kanban-column" style={{ background: color.bg }}>
      <div className="kanban-column-header" style={{ cursor: "pointer", userSelect: "none" }} onClick={onToggleCollapse}>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#9B9A97" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="badge-dot" style={{ background: color.dot, width: 7, height: 7, borderRadius: "50%", flexShrink: 0 }} />
        <span>{groupValue || "(empty)"}</span>
        <span style={{ color: "#9B9A97", fontSize: 11, marginLeft: 4 }}>{count}</span>
      </div>
      {!collapsed && (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {children}
          {addCard}
        </SortableContext>
      )}
    </div>
  );
}

export default function KanbanView({
  rows,
  groupByCol,
  titleCol,
  columns,
  pkCol,
  tableName,
  columnOptions,
  columnInfos,
  onUpdateRow,
  onInsertRow,
}: KanbanViewProps) {
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  // Ref to always read latest activeRow in drag handlers (avoids stale closure)
  const activeRowRef = useRef<Row | null>(activeRow);
  useEffect(() => { activeRowRef.current = activeRow; }, [activeRow]);

  // Sync local state when props change (e.g. after refresh)
  useEffect(() => { setLocalRows(rows); }, [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Resolve status column options for the groupByCol
  const statusOptions = useMemo(() => {
    if (!columnOptions || !tableName) return null;
    const key = `${tableName}.${groupByCol}`;
    const opts = columnOptions[key];
    if (opts && opts.length > 0) return opts.slice().sort((a, b) => a.sort_order - b.sort_order);
    return null;
  }, [columnOptions, tableName, groupByCol]);

  // Build color map: group value -> color object
  const colorMap = useMemo(() => {
    const map = new Map<string, typeof COLORS[0]>();
    if (statusOptions) {
      for (const opt of statusOptions) {
        map.set(opt.value, opt.color ? colorFromHex(opt.color) : COLORS[map.size % COLORS.length]);
      }
    }
    return map;
  }, [statusOptions]);

  // Get ordered groups: use status options if available, otherwise derive from data
  const groups = useMemo(() => {
    if (statusOptions) {
      // Start with all defined status values in sort order
      const ordered = statusOptions.map((o) => o.value);
      // Add any data values not in status options (edge case)
      const seen = new Set(ordered);
      for (const row of localRows) {
        const v = String(row[groupByCol] ?? "");
        if (!seen.has(v)) {
          seen.add(v);
          ordered.push(v);
        }
      }
      return ordered;
    }
    // No status options — derive from data
    const seen = new Set<string>();
    for (const row of localRows) {
      seen.add(String(row[groupByCol] ?? ""));
    }
    return Array.from(seen);
  }, [localRows, groupByCol, statusOptions]);

  const getColor = (group: string, index: number) => {
    return colorMap.get(group) ?? COLORS[index % COLORS.length];
  };

  // Use primary key for stable drag IDs, fallback to index if no pkCol
  const rowId = useCallback((row: Row, idx: number) => {
    if (pkCol && row[pkCol] != null) return `row-${row[pkCol]}`;
    return `row-idx-${idx}`;
  }, [pkCol]);

  // Find a row by its drag ID
  const findRowByDragId = useCallback((id: string, rows: Row[]): Row | undefined => {
    if (id.startsWith("row-idx-")) {
      const idx = Number(id.replace("row-idx-", ""));
      return rows[idx];
    }
    const pkVal = id.replace("row-", "");
    if (pkCol) {
      return rows.find((r) => String(r[pkCol]) === pkVal);
    }
    return undefined;
  }, [pkCol]);

  // Track original group of a dragged card so we can persist the change on dragEnd
  const dragOrigGroup = useRef<string | null>(null);
  // Ref to always read latest localRows in drag handlers (avoids stale closure)
  const localRowsRef = useRef(localRows);
  useEffect(() => { localRowsRef.current = localRows; }, [localRows]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const row = findRowByDragId(String(event.active.id), localRowsRef.current);
    if (row) {
      setActiveRow(row);
      dragOrigGroup.current = String(row[groupByCol] ?? "");
    }
  }, [findRowByDragId, groupByCol]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith("column-")) {
      // Dragged over a column — move to that group
      const targetGroup = overId.replace("column-", "");
      setLocalRows((prev) => {
        const row = findRowByDragId(activeId, prev);
        if (!row || String(row[groupByCol] ?? "") === targetGroup) return prev;
        const idx = prev.indexOf(row);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [groupByCol]: targetGroup };
        return updated;
      });
    } else {
      // Dragged over another card — reorder
      if (activeId === overId) return;
      setLocalRows((prev) => {
        const activeRow = findRowByDragId(activeId, prev);
        const overRow = findRowByDragId(overId, prev);
        if (!activeRow || !overRow) return prev;
        const activeIdx = prev.indexOf(activeRow);
        const overIdx = prev.indexOf(overRow);
        if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(activeIdx, 1);
        // Update group if crossing columns (immutable update)
        const targetGroup = String(overRow[groupByCol] ?? "");
        const updatedRow = String(moved[groupByCol] ?? "") !== targetGroup
          ? { ...moved, [groupByCol]: targetGroup }
          : moved;
        const insertIdx = overIdx > activeIdx ? overIdx - 1 : overIdx;
        updated.splice(insertIdx, 0, updatedRow);
        return updated;
      });
    }
  }, [findRowByDragId, groupByCol, pkCol]);

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    // Read latest values from refs to avoid stale closure
    const currentRows = localRowsRef.current;
    const currentActiveRow = activeRowRef.current;
    if (currentActiveRow && pkCol && onUpdateRow) {
      const row = currentRows.find((r) => r[pkCol] === currentActiveRow[pkCol]);
      const currentGroup = row ? String(row[groupByCol] ?? "") : null;
      const origGroup = dragOrigGroup.current;
      if (currentGroup !== null && origGroup !== null && currentGroup !== origGroup) {
        onUpdateRow(pkCol, currentActiveRow[pkCol], { [groupByCol]: currentGroup });
      }
    }
    setActiveRow(null);
    dragOrigGroup.current = null;
  }, [pkCol, onUpdateRow, groupByCol]);

  const toggleCollapse = useCallback((group: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const handleAddCard = useCallback((group: string, title: string) => {
    if (onInsertRow) {
      onInsertRow({ [groupByCol]: group, [titleCol]: title });
    }
  }, [onInsertRow, groupByCol, titleCol]);

  return (
    <div className="view-kanban">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {groups.map((group, gi) => {
            const color = getColor(group, gi);
            const groupRows = localRows
              .map((r, i) => ({ row: r, idx: i }))
              .filter(({ row }) => String(row[groupByCol] ?? "") === group);
            const ids = groupRows.map(({ row, idx }) => rowId(row, idx));

            return (
              <DroppableColumn
                key={group}
                groupValue={group}
                ids={ids}
                color={color}
                count={groupRows.length}
                collapsed={collapsedCols.has(group)}
                onToggleCollapse={() => toggleCollapse(group)}
                addCard={
                  onInsertRow ? (
                    <InlineAddCard color={color} onAdd={(text) => handleAddCard(group, text)} />
                  ) : undefined
                }
              >
                {groupRows.map(({ row, idx }) => (
                  <SortableCard
                    key={rowId(row, idx)}
                    id={rowId(row, idx)}
                    row={row}
                    titleCol={titleCol}
                    columns={columns}
                    color={color}
                    onClick={() => setSelectedRow(row)}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeRow && (
            <KanbanCard
              row={activeRow}
              titleCol={titleCol}
              columns={columns}
              color={COLORS[0]}
            />
          )}
        </DragOverlay>
      </DndContext>

      <DetailPanel
        row={selectedRow}
        columns={columnInfos ?? []}
        columnOptions={columnOptions ?? {}}
        tableName={tableName ?? ""}
        onClose={() => setSelectedRow(null)}
        onUpdateRow={onUpdateRow}
      />
    </div>
  );
}

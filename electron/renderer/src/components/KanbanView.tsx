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
import { useState, useEffect, useMemo, useRef } from "react";
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

function SortableCard({ row, titleCol, columns, color, id }: { row: Row; titleCol: string; columns: string[]; color: typeof COLORS[0]; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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

  // Build row-id to row index map (using index as stable id)
  const rowId = (idx: number) => `row-${idx}`;

  // Track original group of a dragged card so we can persist the change on dragEnd
  const dragOrigGroup = useRef<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const idx = Number(String(event.active.id).replace("row-", ""));
    if (localRows[idx]) {
      setActiveRow(localRows[idx]);
      dragOrigGroup.current = String(localRows[idx][groupByCol] ?? "");
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdx = Number(String(active.id).replace("row-", ""));
    const overId = String(over.id);

    if (overId.startsWith("column-")) {
      // Dragged over a column — move to that group
      const targetGroup = overId.replace("column-", "");
      setLocalRows((prev) => {
        if (String(prev[activeIdx]?.[groupByCol] ?? "") === targetGroup) return prev;
        const updated = [...prev];
        updated[activeIdx] = { ...updated[activeIdx], [groupByCol]: targetGroup };
        return updated;
      });
    } else {
      // Dragged over another card — reorder
      const overIdx = Number(overId.replace("row-", ""));
      if (activeIdx === overIdx) return;
      setLocalRows((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(activeIdx, 1);
        // Update group if crossing columns
        const targetGroup = String(prev[overIdx]?.[groupByCol] ?? "");
        if (String(moved[groupByCol] ?? "") !== targetGroup) {
          moved[groupByCol] = targetGroup;
        }
        // Insert at the over position (adjusted for removal)
        const insertIdx = overIdx > activeIdx ? overIdx - 1 : overIdx;
        updated.splice(insertIdx, 0, moved);
        return updated;
      });
    }
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    // Persist the change to the database if the card moved to a different column
    if (activeRow && pkCol && onUpdateRow) {
      const activeIdx = localRows.findIndex((r) => r[pkCol] === activeRow[pkCol]);
      const currentGroup = activeIdx >= 0 ? String(localRows[activeIdx][groupByCol] ?? "") : null;
      const origGroup = dragOrigGroup.current;
      if (currentGroup !== null && origGroup !== null && currentGroup !== origGroup) {
        onUpdateRow(pkCol, activeRow[pkCol], { [groupByCol]: currentGroup });
      }
    }
    setActiveRow(null);
    dragOrigGroup.current = null;
  };

  const toggleCollapse = (group: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleAddCard = (group: string, title: string) => {
    if (onInsertRow) {
      onInsertRow({ [groupByCol]: group, [titleCol]: title });
    }
  };

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
            const ids = groupRows.map(({ idx }) => rowId(idx));

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
                    key={rowId(idx)}
                    id={rowId(idx)}
                    row={row}
                    titleCol={titleCol}
                    columns={columns}
                    color={color}
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
    </div>
  );
}

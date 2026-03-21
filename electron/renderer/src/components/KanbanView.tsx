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
import { useState, useEffect, useMemo } from "react";
import type { Row } from "../data";

interface KanbanViewProps {
  rows: Row[];
  groupByCol: string;
  titleCol: string;
  columns: string[];
}

const COLORS = [
  { bg: "rgba(217, 115, 13, 0.06)", card: "rgba(217, 115, 13, 0.12)", border: "rgba(217, 115, 13, 0.2)", dot: "#D9730D" },
  { bg: "rgba(35, 131, 226, 0.06)", card: "rgba(35, 131, 226, 0.12)", border: "rgba(35, 131, 226, 0.2)", dot: "#2383E2" },
  { bg: "rgba(77, 171, 111, 0.06)", card: "rgba(77, 171, 111, 0.12)", border: "rgba(77, 171, 111, 0.2)", dot: "#4DAB6F" },
  { bg: "rgba(224, 62, 62, 0.06)", card: "rgba(224, 62, 62, 0.12)", border: "rgba(224, 62, 62, 0.2)", dot: "#E03E3E" },
  { bg: "rgba(155, 154, 151, 0.06)", card: "rgba(155, 154, 151, 0.12)", border: "rgba(155, 154, 151, 0.2)", dot: "#9B9A97" },
  { bg: "rgba(105, 64, 165, 0.06)", card: "rgba(105, 64, 165, 0.12)", border: "rgba(105, 64, 165, 0.2)", dot: "#6940A5" },
];

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

function DroppableColumn({ groupValue, ids, color, children }: { groupValue: string; ids: string[]; color: typeof COLORS[0]; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `column-${groupValue}` });

  return (
    <div ref={setNodeRef} className="kanban-column" style={{ background: color.bg }}>
      <div className="kanban-column-header">
        <span className="badge-dot" style={{ background: color.dot, width: 7, height: 7, borderRadius: "50%", flexShrink: 0 }} />
        <span>{groupValue || "(empty)"}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

export default function KanbanView({ rows, groupByCol, titleCol, columns }: KanbanViewProps) {
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);

  // Sync local state when props change (e.g. after refresh)
  useEffect(() => { setLocalRows(rows); }, [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Get unique group values
  const groups = useMemo(() => {
    const seen = new Set<string>();
    for (const row of localRows) {
      seen.add(String(row[groupByCol] ?? ""));
    }
    return Array.from(seen);
  }, [localRows, groupByCol]);

  // Build row-id to row index map (using index as stable id)
  const rowId = (idx: number) => `row-${idx}`;

  const handleDragStart = (event: DragStartEvent) => {
    const idx = Number(String(event.active.id).replace("row-", ""));
    if (localRows[idx]) setActiveRow(localRows[idx]);
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
    setActiveRow(null);
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
            const color = COLORS[gi % COLORS.length];
            const groupRows = localRows
              .map((r, i) => ({ row: r, idx: i }))
              .filter(({ row }) => String(row[groupByCol] ?? "") === group);
            const ids = groupRows.map(({ idx }) => rowId(idx));

            return (
              <DroppableColumn key={group} groupValue={group} ids={ids} color={color}>
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

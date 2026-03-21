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
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useCallback } from "react";
import Badge from "./Badge";
import { STATUSES, STATUS_CONFIG, type Task, type Status } from "../data";

interface KanbanViewProps {
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: Status, newIndex?: number) => void;
}

function KanbanCard({ task, cardClass }: { task: Task; cardClass: string }) {
  return (
    <div className={`kanban-card ${cardClass}`}>
      <span className="kanban-card-title">{task.title}</span>
      <div className="kanban-card-meta">
        <Badge dot={task.priorityDot} label={task.priority} className="kanban-badge" />
        <span className="kanban-card-date">{task.date}</span>
      </div>
    </div>
  );
}

function SortableCard({ task, cardClass }: { task: Task; cardClass: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} cardClass={cardClass} />
    </div>
  );
}

function DroppableColumn({ status, taskIds, children }: { status: Status; taskIds: string[]; children: React.ReactNode }) {
  const config = STATUS_CONFIG[status];
  const { setNodeRef } = useDroppable({ id: `column-${status}`, data: { status } });

  return (
    <div ref={setNodeRef} className={`kanban-column ${config.columnClass}`}>
      <div className="kanban-column-header">
        <span className={`badge-dot ${config.dot}`} />
        <span>{status}</span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

export default function KanbanView({ tasks, onMoveTask }: KanbanViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = useCallback(
    (status: Status) => tasks.filter((t) => t.status === status),
    [tasks]
  );

  const findStatus = (id: string | number): Status | null => {
    // Check if it's a column droppable
    const colId = String(id);
    if (colId.startsWith("column-")) {
      return colId.replace("column-", "") as Status;
    }
    // It's a task id
    const task = tasks.find((t) => t.id === String(id));
    return task?.status ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(event.active.id));
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const activeStatus = findStatus(activeId);
    const overStatus = findStatus(over.id);

    if (!activeStatus || !overStatus || activeStatus === overStatus) return;

    // Move to the new column immediately for visual feedback
    const overTasks = tasksByStatus(overStatus);
    const overTask = tasks.find((t) => t.id === String(over.id));
    const newIndex = overTask ? overTasks.indexOf(overTask) : overTasks.length;

    onMoveTask(activeId, overStatus, newIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    const overStatus = findStatus(over.id);
    if (!overStatus) return;

    // Same column reorder
    if (activeTask.status === overStatus && activeId !== overId) {
      const columnTasks = tasksByStatus(overStatus);
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        onMoveTask(activeId, overStatus, newIndex);
      }
    }
    // Cross-column (already handled in dragOver, but finalize position)
    else if (activeTask.status !== overStatus) {
      const overTask = tasks.find((t) => t.id === overId);
      const overTasks = tasksByStatus(overStatus);
      const newIndex = overTask ? overTasks.indexOf(overTask) : overTasks.length;
      onMoveTask(activeId, overStatus, newIndex);
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
          {STATUSES.map((status) => {
            const columnTasks = tasksByStatus(status);
            const config = STATUS_CONFIG[status];
            return (
              <DroppableColumn key={status} status={status} taskIds={columnTasks.map((t) => t.id)}>
                {columnTasks.map((task) => (
                  <SortableCard key={task.id} task={task} cardClass={config.cardClass} />
                ))}
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeTask && (
            <KanbanCard
              task={activeTask}
              cardClass={STATUS_CONFIG[activeTask.status].cardClass}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

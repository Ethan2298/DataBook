import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import TableView from "./components/TableView";
import KanbanView from "./components/KanbanView";
import CalendarView from "./components/CalendarView";
import { initialTasks, type Task, type Status } from "./data";

export type ViewType = "Table" | "Board" | "Calendar";

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>("Table");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const moveTask = (taskId: string, newStatus: Status, newIndex?: number) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;

      const updated = {
        ...task,
        status: newStatus,
        statusDot: `dot-${newStatus.toLowerCase().replace(/ /g, "-")}`,
      };

      // Remove the task from its current position
      const without = prev.filter((t) => t.id !== taskId);

      if (newIndex === undefined) {
        // Append to end of the target status group
        const lastIdx = without.reduce(
          (acc, t, i) => (t.status === newStatus ? i : acc),
          -1
        );
        without.splice(lastIdx + 1, 0, updated);
        return without;
      }

      // Insert at specific position within the status group
      const statusTasks = without.filter((t) => t.status === newStatus);
      const insertAfter = newIndex > 0 ? statusTasks[newIndex - 1] : null;

      if (insertAfter) {
        const globalIdx = without.indexOf(insertAfter) + 1;
        without.splice(globalIdx, 0, updated);
      } else {
        // Insert before the first task of this status
        const firstIdx = without.findIndex((t) => t.status === newStatus);
        without.splice(firstIdx === -1 ? without.length : firstIdx, 0, updated);
      }

      return without;
    });
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <TopBar activeView={activeView} onViewChange={setActiveView} />
        {activeView === "Table" && <TableView tasks={tasks} />}
        {activeView === "Board" && <KanbanView tasks={tasks} onMoveTask={moveTask} />}
        {activeView === "Calendar" && <CalendarView tasks={tasks} />}
      </main>
    </div>
  );
}

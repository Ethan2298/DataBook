export type Status = "To Do" | "In Progress" | "Done";

export interface Task {
  id: string;
  title: string;
  priority: string;
  priorityDot: string;
  status: Status;
  statusDot: string;
  date: string;
}

export const STATUS_CONFIG: Record<Status, { dot: string; columnClass: string; cardClass: string }> = {
  "To Do": { dot: "dot-todo", columnClass: "kanban-todo", cardClass: "kanban-card-todo" },
  "In Progress": { dot: "dot-in-progress", columnClass: "kanban-in-progress", cardClass: "kanban-card-in-progress" },
  "Done": { dot: "dot-done", columnClass: "kanban-done", cardClass: "kanban-card-done" },
};

export const STATUSES: Status[] = ["To Do", "In Progress", "Done"];

export const initialTasks: Task[] = [
  { id: "1", title: "Design landing page", priority: "High", priorityDot: "dot-high", status: "Done", statusDot: "dot-done", date: "Mar 12, 2025" },
  { id: "2", title: "Fix auth bug", priority: "Urgent", priorityDot: "dot-urgent", status: "In Progress", statusDot: "dot-in-progress", date: "Mar 18, 2025" },
  { id: "3", title: "Write API docs", priority: "Medium", priorityDot: "dot-medium", status: "Done", statusDot: "dot-done", date: "Mar 15, 2025" },
  { id: "4", title: "Setup CI pipeline", priority: "High", priorityDot: "dot-high", status: "In Progress", statusDot: "dot-in-progress", date: "Mar 20, 2025" },
  { id: "5", title: "Refactor sidebar", priority: "Low", priorityDot: "dot-low", status: "Done", statusDot: "dot-done", date: "Mar 14, 2025" },
  { id: "6", title: "Migrate user database", priority: "High", priorityDot: "dot-high", status: "To Do", statusDot: "dot-todo", date: "Mar 25, 2025" },
  { id: "7", title: "Update onboarding flow", priority: "Medium", priorityDot: "dot-medium", status: "In Progress", statusDot: "dot-in-progress", date: "Mar 22, 2025" },
];

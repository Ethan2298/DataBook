// Shared types — no hardcoded data

export interface QueryPage {
  id: string;
  name: string;
  database: string;
  query: string;
  view_type: string;
  created_at: string;
  updated_at: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export type Row = Record<string, unknown>;

export type ViewType = "table" | "kanban" | "calendar";

export interface ActiveItem {
  kind: "table" | "query_page";
  name: string;
  viewType: ViewType;
  sql: string;
}

export interface ColumnOption {
  value: string;
  color: string;
  sort_order: number;
}

// Map of "table.column" -> ColumnOption[]
export type ColumnOptionsMap = Record<string, ColumnOption[]>;

// ── Filter & Sort types ────────────────────────────────────────────────────

export type TextOperator = "contains" | "does_not_contain" | "is" | "is_not" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
export type NumberOperator = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty";
export type BooleanOperator = "is_checked" | "is_not_checked";
export type StatusOperator = "is" | "is_not" | "is_empty" | "is_not_empty";
export type DateOperator = "is" | "is_before" | "is_after" | "is_on_or_before" | "is_on_or_after" | "is_empty" | "is_not_empty";

export type FilterOperator = TextOperator | NumberOperator | BooleanOperator | StatusOperator | DateOperator;

export interface FilterRule {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterGroup {
  conjunction: "and" | "or";
  rules: FilterRule[];
}

export interface SortRule {
  id: string;
  column: string;
  direction: "asc" | "desc";
}

export interface ViewFilterSort {
  filters: FilterGroup;
  sorts: SortRule[];
}

export type ColumnCategory = "text" | "number" | "boolean" | "status" | "date";

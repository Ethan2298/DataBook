// Shared types — no hardcoded data

export interface QueryPage {
  id: string;
  name: string;
  database: string;
  query: string;
  view_type: string;
  view_config: string | null;
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

export interface ViewConfig {
  groupByCol?: string;
  titleCol?: string;
  dateCol?: string;
}

export type FieldType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email' | 'phone' | 'status' | 'person' | 'file' | 'relation' | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by' | 'unique_id';

export interface ColumnMetadata {
  column: string;
  field_type: FieldType;
  config: Record<string, unknown>;
}

// Map of column_name -> ColumnMetadata
export type ColumnMetadataMap = Record<string, ColumnMetadata>;

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

// ── Row History types ────────────────────────────────────────────────────

export interface RowHistoryEntry {
  id: number;
  database: string;
  table: string;
  row_pk: string | null;
  action: "insert" | "update" | "delete";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Commit {
  id: number;
  database: string;
  message: string;
  created_at: string;
  change_count: number;
}

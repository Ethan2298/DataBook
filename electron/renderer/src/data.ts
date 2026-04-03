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

export type FieldType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email';

export interface ColumnMetadata {
  column: string;
  field_type: FieldType;
  config: Record<string, unknown>;
}

// Map of column_name -> ColumnMetadata
export type ColumnMetadataMap = Record<string, ColumnMetadata>;

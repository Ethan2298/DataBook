// Typed wrapper around the preload-exposed IPC bridge

import type { QueryPage, ColumnInfo, ColumnOption } from "./data";

export interface ColumnDef {
  name: string;
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: string;
}

interface DataBookAPI {
  onExternalChange(callback: () => void): () => void;

  listDatabases(): Promise<string[]>;
  createDatabase(name: string): Promise<void>;
  deleteDatabase(name: string): Promise<void>;
  selectDatabase(name: string): Promise<void>;

  listTables(): Promise<string[]>;
  describeTable(table: string): Promise<ColumnInfo[]>;
  createTable(table: string, columns: ColumnDef[]): Promise<void>;
  alterTable(table: string, operations: unknown[]): Promise<void>;
  dropTable(table: string): Promise<void>;

  insertRows(table: string, rows: Record<string, unknown>[]): Promise<number>;
  updateRows(table: string, set: Record<string, unknown>, where: string, params?: unknown[]): Promise<number>;
  deleteRows(table: string, where: string, params?: unknown[]): Promise<number>;

  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;

  createQueryPage(name: string, query: string, viewType: string): Promise<QueryPage>;
  listQueryPages(): Promise<QueryPage[]>;
  updateQueryPage(name: string, updates: Partial<Pick<QueryPage, 'name' | 'query' | 'view_type'>>): Promise<QueryPage>;
  deleteQueryPage(name: string): Promise<void>;

  getColumnOptions(table: string, column: string): Promise<ColumnOption[]>;
  getAllColumnOptions(): Promise<Record<string, ColumnOption[]>>;
  addColumnOption(table: string, column: string, value: string, color: string): Promise<void>;
  removeColumnOption(table: string, column: string, value: string): Promise<void>;

  getColumnOrder(table: string): Promise<string[]>;
  setColumnOrder(table: string, columns: string[]): Promise<void>;
}

declare global {
  interface Window {
    databook: DataBookAPI;
  }
}

const api: DataBookAPI = window.databook;

export default api;

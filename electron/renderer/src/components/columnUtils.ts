import type { ColumnInfo } from "../data";

/**
 * Returns the name of the primary-key column, or `undefined` if none is found.
 * Shared by DetailPanel and TableView to avoid duplicated logic.
 */
export function getPkColumn(columns: ColumnInfo[]): string | undefined {
  const pkDef = columns.find((c) => c.pk);
  if (pkDef) return pkDef.name;
  return undefined;
}

/**
 * Returns true when a column should be treated as a non-editable primary-key /
 * identity column (explicit PK flag, or conventional "id" / "rowid" names).
 */
export function isPkColumn(columns: ColumnInfo[], col: string): boolean {
  const colDef = columns.find((c) => c.name === col);
  if (colDef?.pk) return true;
  if (col.toLowerCase() === "id" || col.toLowerCase() === "rowid") return true;
  return false;
}

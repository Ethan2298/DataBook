// Pure filter & sort engine — no React dependencies

import type {
  Row,
  ColumnInfo,
  FilterGroup,
  FilterRule,
  SortRule,
  ViewFilterSort,
  ColumnCategory,
} from "./data";

// ── Column category detection ──────────────────────────────────────────────

export function getColumnCategory(col: ColumnInfo): ColumnCategory {
  const t = col.type.toUpperCase();
  if (t === "BOOLEAN") return "boolean";
  if (t === "STATUS") return "status";
  if (["INTEGER", "REAL", "NUMERIC"].includes(t)) return "number";
  if (/date|time|created|updated|_at$/i.test(col.name)) return "date";
  return "text";
}

// ── Operator lists per category ────────────────────────────────────────────

export function getOperatorsForCategory(
  category: ColumnCategory
): { value: FilterOperator; label: string }[] {
  switch (category) {
    case "text":
      return [
        { value: "contains", label: "Contains" },
        { value: "does_not_contain", label: "Does not contain" },
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
        { value: "starts_with", label: "Starts with" },
        { value: "ends_with", label: "Ends with" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "number":
      return [
        { value: "eq", label: "=" },
        { value: "neq", label: "\u2260" },
        { value: "gt", label: ">" },
        { value: "lt", label: "<" },
        { value: "gte", label: "\u2265" },
        { value: "lte", label: "\u2264" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "boolean":
      return [
        { value: "is_checked", label: "Is checked" },
        { value: "is_not_checked", label: "Is not checked" },
      ];
    case "status":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "date":
      return [
        { value: "is", label: "Is" },
        { value: "is_before", label: "Is before" },
        { value: "is_after", label: "Is after" },
        { value: "is_on_or_before", label: "Is on or before" },
        { value: "is_on_or_after", label: "Is on or after" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isEmpty(val: unknown): boolean {
  return val == null || String(val).trim() === "";
}

function toStr(val: unknown): string {
  return val == null ? "" : String(val).toLowerCase();
}

function toNum(val: unknown): number {
  if (val == null) return NaN;
  const n = Number(val);
  return n;
}

function toDate(val: unknown): number {
  if (val == null) return NaN;
  const d = new Date(val as string);
  return d.getTime();
}

function stripTime(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ── Single rule evaluation ─────────────────────────────────────────────────

function evaluateRule(
  row: Row,
  rule: FilterRule,
  colMap: Map<string, ColumnInfo>
): boolean {
  const col = colMap.get(rule.column);
  if (!col) return true; // column removed — skip rule
  const val = row[rule.column];
  const category = getColumnCategory(col);

  // Universal empty checks
  if (rule.operator === "is_empty") return isEmpty(val);
  if (rule.operator === "is_not_empty") return !isEmpty(val);

  switch (category) {
    case "text":
    case "status": {
      const s = toStr(val);
      const v = rule.value.toLowerCase();
      switch (rule.operator) {
        case "contains":
          return s.includes(v);
        case "does_not_contain":
          return !s.includes(v);
        case "is":
          return s === v;
        case "is_not":
          return s !== v;
        case "starts_with":
          return s.startsWith(v);
        case "ends_with":
          return s.endsWith(v);
        default:
          return true;
      }
    }
    case "number": {
      const n = toNum(val);
      const v = Number(rule.value);
      if (isNaN(n) || isNaN(v)) return false;
      switch (rule.operator) {
        case "eq":
          return n === v;
        case "neq":
          return n !== v;
        case "gt":
          return n > v;
        case "lt":
          return n < v;
        case "gte":
          return n >= v;
        case "lte":
          return n <= v;
        default:
          return true;
      }
    }
    case "boolean": {
      const b = val === 1 || val === true || val === "1" || val === "true";
      switch (rule.operator) {
        case "is_checked":
          return b;
        case "is_not_checked":
          return !b;
        default:
          return true;
      }
    }
    case "date": {
      const d = stripTime(toDate(val));
      const v = stripTime(toDate(rule.value));
      if (isNaN(d) || isNaN(v)) return false;
      switch (rule.operator) {
        case "is":
          return d === v;
        case "is_before":
          return d < v;
        case "is_after":
          return d > v;
        case "is_on_or_before":
          return d <= v;
        case "is_on_or_after":
          return d >= v;
        default:
          return true;
      }
    }
  }
}

// ── Apply filters ──────────────────────────────────────────────────────────

export function applyFilters(
  rows: Row[],
  filters: FilterGroup,
  columns: ColumnInfo[]
): Row[] {
  if (filters.rules.length === 0) return rows;

  const colMap = new Map(columns.map((c) => [c.name, c]));

  return rows.filter((row) => {
    if (filters.conjunction === "and") {
      return filters.rules.every((rule) => evaluateRule(row, rule, colMap));
    }
    return filters.rules.some((rule) => evaluateRule(row, rule, colMap));
  });
}

// ── Apply sorts ────────────────────────────────────────────────────────────

export function applySorts(
  rows: Row[],
  sorts: SortRule[],
  columns: ColumnInfo[]
): Row[] {
  if (sorts.length === 0) return rows;

  const colMap = new Map(columns.map((c) => [c.name, c]));
  const sorted = [...rows];

  sorted.sort((a, b) => {
    for (const rule of sorts) {
      const col = colMap.get(rule.column);
      if (!col) continue;
      const category = getColumnCategory(col);
      const dir = rule.direction === "asc" ? 1 : -1;
      const va = a[rule.column];
      const vb = b[rule.column];

      // Nulls always sort last regardless of direction
      if (isEmpty(va) && isEmpty(vb)) continue;
      if (isEmpty(va)) return 1;
      if (isEmpty(vb)) return -1;

      let cmp = 0;
      switch (category) {
        case "number": {
          cmp = toNum(va) - toNum(vb);
          break;
        }
        case "date": {
          cmp = toDate(va) - toDate(vb);
          break;
        }
        case "boolean": {
          const ba = va === 1 || va === true ? 1 : 0;
          const bb = vb === 1 || vb === true ? 1 : 0;
          cmp = ba - bb;
          break;
        }
        default: {
          cmp = String(va).localeCompare(String(vb));
          break;
        }
      }
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });

  return sorted;
}

// ── Combined convenience ───────────────────────────────────────────────────

export function applyFilterSort(
  rows: Row[],
  config: ViewFilterSort,
  columns: ColumnInfo[]
): Row[] {
  const filtered = applyFilters(rows, config.filters, columns);
  return applySorts(filtered, config.sorts, columns);
}

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ColumnInfo,
  ColumnOptionsMap,
  FilterGroup,
  FilterRule,
  FilterOperator,
  SortRule,
} from "../data";
import { getColumnCategory, getOperatorsForCategory } from "../filter-sort";

// ── Props ──────────────────────────────────────────────────────────────────

interface FilterSortBarProps {
  columns: ColumnInfo[];
  columnOptions: ColumnOptionsMap;
  activeTableName: string;
  filters: FilterGroup;
  sorts: SortRule[];
  onFiltersChange: (filters: FilterGroup) => void;
  onSortsChange: (sorts: SortRule[]) => void;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SortIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5h10" /><path d="M11 9h7" /><path d="M11 13h4" />
    <path d="M3 17l3 3 3-3" /><path d="M6 18V4" />
  </svg>
);

const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function getCategoryForColumn(col: ColumnInfo | undefined): ColumnCategory {
  if (!col) return "text";
  return getColumnCategory(col);
}

// ── Click-outside hook ─────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

// ── Sortable sort rule ─────────────────────────────────────────────────────

function SortableRow({
  rule,
  columns,
  onUpdate,
  onDelete,
}: {
  rule: SortRule;
  columns: ColumnInfo[];
  onUpdate: (id: string, updates: Partial<SortRule>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div className="sort-rule-row" ref={setNodeRef} style={style}>
      <span className="sort-drag-handle" {...attributes} {...listeners}>
        <GripIcon />
      </span>
      <select
        className="filter-select"
        value={rule.column}
        onChange={(e) => onUpdate(rule.id, { column: e.target.value })}
      >
        {columns.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
      <button
        className={`direction-toggle ${rule.direction}`}
        onClick={() => onUpdate(rule.id, { direction: rule.direction === "asc" ? "desc" : "asc" })}
      >
        {rule.direction === "asc" ? "Ascending" : "Descending"}
      </button>
      <button className="rule-delete-btn" onClick={() => onDelete(rule.id)} title="Remove sort">&times;</button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function FilterSortBar({
  columns,
  columnOptions,
  activeTableName,
  filters,
  sorts,
  onFiltersChange,
  onSortsChange,
}: FilterSortBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const closeFilters = useCallback(() => setShowFilters(false), []);
  const closeSorts = useCallback(() => setShowSorts(false), []);

  useClickOutside(filterRef, closeFilters);
  useClickOutside(sortRef, closeSorts);

  const colMap = new Map(columns.map((c) => [c.name, c]));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // ── Filter handlers ────────────────────────────────────────────────────

  const addFilter = () => {
    if (columns.length === 0) return;
    const col = columns[0];
    const category = getColumnCategory(col);
    const ops = getOperatorsForCategory(category);
    const rule: FilterRule = {
      id: uid(),
      column: col.name,
      operator: ops[0].value,
      value: "",
    };
    onFiltersChange({ ...filters, rules: [...filters.rules, rule] });
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    const newRules = filters.rules.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };
      // When column changes, reset operator to first valid one for new category
      if (updates.column && updates.column !== r.column) {
        const col = colMap.get(updates.column);
        const category = getCategoryForColumn(col);
        const ops = getOperatorsForCategory(category);
        updated.operator = ops[0].value;
        updated.value = "";
      }
      return updated;
    });
    onFiltersChange({ ...filters, rules: newRules });
  };

  const deleteFilter = (id: string) => {
    onFiltersChange({ ...filters, rules: filters.rules.filter((r) => r.id !== id) });
  };

  const toggleConjunction = () => {
    onFiltersChange({ ...filters, conjunction: filters.conjunction === "and" ? "or" : "and" });
  };

  // ── Sort handlers ──────────────────────────────────────────────────────

  const addSort = () => {
    if (columns.length === 0) return;
    const rule: SortRule = { id: uid(), column: columns[0].name, direction: "asc" };
    onSortsChange([...sorts, rule]);
  };

  const updateSort = (id: string, updates: Partial<SortRule>) => {
    onSortsChange(sorts.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteSort = (id: string) => {
    onSortsChange(sorts.filter((r) => r.id !== id));
  };

  const handleSortDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sorts.findIndex((r) => r.id === active.id);
    const newIdx = sorts.findIndex((r) => r.id === over.id);
    onSortsChange(arrayMove(sorts, oldIdx, newIdx));
  };

  // ── Value input based on column category ───────────────────────────────

  const renderValueInput = (rule: FilterRule) => {
    const col = colMap.get(rule.column);
    const category = getCategoryForColumn(col);

    // No value input needed for these operators
    if (["is_empty", "is_not_empty", "is_checked", "is_not_checked"].includes(rule.operator)) {
      return null;
    }

    if (category === "status") {
      const key = `${activeTableName}.${rule.column}`;
      const options = columnOptions[key] ?? [];
      return (
        <select
          className="filter-select"
          value={rule.value}
          onChange={(e) => updateFilter(rule.id, { value: e.target.value })}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.value}</option>
          ))}
        </select>
      );
    }

    if (category === "date") {
      return (
        <input
          type="date"
          className="filter-value-input"
          value={rule.value}
          onChange={(e) => updateFilter(rule.id, { value: e.target.value })}
        />
      );
    }

    if (category === "number") {
      return (
        <input
          type="number"
          className="filter-value-input"
          placeholder="Value..."
          value={rule.value}
          onChange={(e) => updateFilter(rule.id, { value: e.target.value })}
        />
      );
    }

    return (
      <input
        type="text"
        className="filter-value-input"
        placeholder="Value..."
        value={rule.value}
        onChange={(e) => updateFilter(rule.id, { value: e.target.value })}
      />
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (columns.length === 0) return null;

  return (
    <div className="filter-sort-bar">
      {/* Filter button + popover */}
      <div className="filter-sort-anchor" ref={filterRef}>
        <button
          className={`action-btn ${filters.rules.length > 0 ? "active" : ""}`}
          onClick={() => { setShowFilters(!showFilters); setShowSorts(false); }}
          aria-expanded={showFilters}
          aria-label={`Filter${filters.rules.length > 0 ? ` (${filters.rules.length} active)` : ""}`}
        >
          <FilterIcon />
          Filter
          {filters.rules.length > 0 && (
            <span className="count-badge">{filters.rules.length}</span>
          )}
        </button>

        {showFilters && (
          <div className="filter-sort-popover">
            {filters.rules.length > 0 && (
              <div className="conjunction-row">
                <span className="conjunction-label">Where</span>
                {filters.rules.length > 1 && (
                  <button className="conjunction-toggle" onClick={toggleConjunction}>
                    {filters.conjunction.toUpperCase()}
                  </button>
                )}
              </div>
            )}

            {filters.rules.map((rule) => {
              const col = colMap.get(rule.column);
              const category = getCategoryForColumn(col);
              const operators = getOperatorsForCategory(category);

              return (
                <div key={rule.id} className="filter-rule-row">
                  <select
                    className="filter-select"
                    value={rule.column}
                    onChange={(e) => updateFilter(rule.id, { column: e.target.value })}
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    value={rule.operator}
                    onChange={(e) => updateFilter(rule.id, { operator: e.target.value as FilterOperator })}
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {renderValueInput(rule)}
                  <button className="rule-delete-btn" onClick={() => deleteFilter(rule.id)} title="Remove filter">&times;</button>
                </div>
              );
            })}

            <button className="add-rule-btn" onClick={addFilter}>
              + Add filter
            </button>
          </div>
        )}
      </div>

      {/* Sort button + popover */}
      <div className="filter-sort-anchor" ref={sortRef}>
        <button
          className={`action-btn ${sorts.length > 0 ? "active" : ""}`}
          onClick={() => { setShowSorts(!showSorts); setShowFilters(false); }}
          aria-expanded={showSorts}
          aria-label={`Sort${sorts.length > 0 ? ` (${sorts.length} active)` : ""}`}
        >
          <SortIcon />
          Sort
          {sorts.length > 0 && (
            <span className="count-badge">{sorts.length}</span>
          )}
        </button>

        {showSorts && (
          <div className="filter-sort-popover">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortDragEnd}>
              <SortableContext items={sorts.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {sorts.map((rule) => (
                  <SortableRow
                    key={rule.id}
                    rule={rule}
                    columns={columns}
                    onUpdate={updateSort}
                    onDelete={deleteSort}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <button className="add-rule-btn" onClick={addSort}>
              + Add sort
            </button>
          </div>
        )}
      </div>

      {/* Active pills */}
      {(filters.rules.length > 0 || sorts.length > 0) && (
        <div className="active-pills">
          {filters.rules.length > 0 && (
            <span className="active-pill">
              {filters.rules.length} filter{filters.rules.length > 1 ? "s" : ""}
              <button
                className="active-pill-close"
                onClick={() => onFiltersChange({ ...filters, rules: [] })}
              >
                &times;
              </button>
            </span>
          )}
          {sorts.length > 0 && (
            <span className="active-pill">
              {sorts.length} sort{sorts.length > 1 ? "s" : ""}
              <button
                className="active-pill-close"
                onClick={() => onSortsChange([])}
              >
                &times;
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

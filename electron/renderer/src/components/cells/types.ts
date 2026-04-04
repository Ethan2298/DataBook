import type { ColumnMetadata } from "../../data";

export interface CellProps {
  value: unknown;
  metadata: ColumnMetadata;
  onCommitEdit: (value: unknown) => void;
  disabled?: boolean;
}

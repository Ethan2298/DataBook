import type { ColumnMetadata } from "../../data";
import TextCell from "./TextCell";
import NumberCell from "./NumberCell";
import CheckboxCell from "./CheckboxCell";
import SelectCell from "./SelectCell";
import MultiSelectCell from "./MultiSelectCell";
import DateCell from "./DateCell";
import UrlCell from "./UrlCell";
import EmailCell from "./EmailCell";
import type { CellProps } from "./types";

interface CellRendererProps {
  value: unknown;
  metadata: ColumnMetadata;
  onCommitEdit: (value: unknown) => void;
  disabled?: boolean;
}

export default function CellRenderer(props: CellRendererProps) {
  const cellProps: CellProps = props;

  switch (props.metadata.field_type) {
    case "checkbox":
      return <CheckboxCell {...cellProps} />;
    case "select":
      return <SelectCell {...cellProps} />;
    case "multi_select":
      return <MultiSelectCell {...cellProps} />;
    case "date":
      return <DateCell {...cellProps} />;
    case "number":
      return <NumberCell {...cellProps} />;
    case "url":
      return <UrlCell {...cellProps} />;
    case "email":
      return <EmailCell {...cellProps} />;
    default:
      return <TextCell {...cellProps} />;
  }
}

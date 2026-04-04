import type { ColumnMetadata } from "../../data";
import TextCell from "./TextCell";
import NumberCell from "./NumberCell";
import CheckboxCell from "./CheckboxCell";
import SelectCell from "./SelectCell";
import MultiSelectCell from "./MultiSelectCell";
import DateCell from "./DateCell";
import UrlCell from "./UrlCell";
import EmailCell from "./EmailCell";
import PhoneCell from "./PhoneCell";
import StatusCell from "./StatusCell";
import PersonCell from "./PersonCell";
import FileCell from "./FileCell";
import RelationCell from "./RelationCell";
import RollupCell from "./RollupCell";
import ReadOnlyDateCell from "./ReadOnlyDateCell";
import ReadOnlyPersonCell from "./ReadOnlyPersonCell";
import UniqueIdCell from "./UniqueIdCell";
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
    case "phone":
      return <PhoneCell {...cellProps} />;
    case "status":
      return <StatusCell {...cellProps} />;
    case "person":
      return <PersonCell {...cellProps} />;
    case "file":
      return <FileCell {...cellProps} />;
    case "relation":
      return <RelationCell {...cellProps} />;
    case "rollup":
      return <RollupCell {...cellProps} />;
    case "created_time":
    case "last_edited_time":
      return <ReadOnlyDateCell {...cellProps} />;
    case "created_by":
    case "last_edited_by":
      return <ReadOnlyPersonCell {...cellProps} />;
    case "unique_id":
      return <UniqueIdCell {...cellProps} />;
    default:
      return <TextCell {...cellProps} />;
  }
}

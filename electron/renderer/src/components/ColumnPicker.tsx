interface ColumnPickerProps {
  label: string;
  value: string;
  options: string[];
  onChange: (col: string) => void;
}

export default function ColumnPicker({ label, value, options, onChange }: ColumnPickerProps) {
  return (
    <div className="column-picker">
      <label className="column-picker-label">{label}</label>
      <select
        className="column-picker-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
    </div>
  );
}

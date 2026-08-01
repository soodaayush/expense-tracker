import { FIELD_LABELS, TARGET_FIELDS, TargetField } from "../../lib/csvValidation";

interface ColumnMapperProps {
  headers: string[];
  mapping: Record<TargetField, string | null>;
  onChange: (mapping: Record<TargetField, string | null>) => void;
}

export default function ColumnMapper({ headers, mapping, onChange }: ColumnMapperProps) {
  return (
    <div className="column-mapper">
      {TARGET_FIELDS.map((field) => (
        <label key={field}>
          {FIELD_LABELS[field]}
          <select
            value={mapping[field] ?? ""}
            onChange={(e) => onChange({ ...mapping, [field]: e.target.value || null })}
          >
            <option value="">— ignore —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

import { ValidatedRow } from "../../lib/csvValidation";

export default function ImportPreviewTable({ rows }: { rows: ValidatedRow[] }) {
  const validCount = rows.filter((r) => r.valid).length;

  return (
    <div className="import-preview">
      <p>
        {validCount} valid, {rows.length - validCount} invalid (invalid rows will be skipped)
      </p>
      <table className="bills-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Payee</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Paid Date</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.valid ? "" : "row-invalid"}>
              <td>{r.valid ? "✓" : r.error}</td>
              <td>{r.input.payee}</td>
              <td>{r.input.amount ?? ""}</td>
              <td>{r.input.dueDate}</td>
              <td>{r.input.paidDate ?? ""}</td>
              <td>{r.input.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

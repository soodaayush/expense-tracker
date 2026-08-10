import { useMemo, useState } from "react";
import { ValidatedRow } from "../../lib/csvValidation";

// Same fix as the bills grid: rendering every row into the DOM at once is what caused the
// lag on large imports, not the validation logic itself — so this windows the render to
// PAGE_SIZE rows instead of dropping the preview altogether.
const PAGE_SIZE = 100;

export default function ImportPreviewTable({ rows }: { rows: ValidatedRow[] }) {
  const [pageIndex, setPageIndex] = useState(0);

  const validCount = rows.filter((r) => r.valid).length;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(clampedPageIndex * PAGE_SIZE, clampedPageIndex * PAGE_SIZE + PAGE_SIZE),
    [rows, clampedPageIndex]
  );

  return (
    <div className="import-preview">
      <p>
        {validCount} valid, {rows.length - validCount} invalid (invalid rows will be skipped)
      </p>
      <div className="table-scroll">
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
            {pageRows.map((r, i) => (
              <tr key={clampedPageIndex * PAGE_SIZE + i} className={r.valid ? "" : "row-invalid"}>
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
      {pageCount > 1 && (
        <div className="grid-pager">
          <button
            className="btn-link"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={clampedPageIndex === 0}
          >
            Previous
          </button>
          <span>
            Page {clampedPageIndex + 1} of {pageCount} ({rows.length} rows)
          </span>
          <button
            className="btn-link"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPageIndex >= pageCount - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

import { PayeeLateStats } from "../../lib/reportStats";

interface LateByPayeeListProps {
  payees: PayeeLateStats[]; // already sorted desc by lateCount, capped by the caller
  full: PayeeLateStats[];
}

export default function LateByPayeeList({ payees, full }: LateByPayeeListProps) {
  const max = Math.max(1, ...payees.map((p) => p.lateCount));

  return (
    <div className="report-card">
      <h3>Late payments by payee</h3>
      {payees.length === 0 ? (
        <p className="report-empty">No late payments — everything's been paid on time.</p>
      ) : (
        <>
          <div className="bar-list">
            {payees.map((p) => (
              <div className="bar-row" key={p.name}>
                <span className="bar-label" title={p.name}>
                  {p.name}
                </span>
                <div className="bar-track">
                  <div className="bar-fill bar-fill-warning" style={{ width: `${(p.lateCount / max) * 100}%` }} />
                </div>
                <span className="bar-value">
                  {p.lateCount} late ({Math.round(p.lateRate * 100)}%)
                </span>
              </div>
            ))}
          </div>
          {full.length > payees.length && (
            <details className="report-table-toggle">
              <summary>View as table ({full.length})</summary>
              <div className="table-scroll">
                <table className="bills-table report-table">
                  <thead>
                    <tr>
                      <th>Payee</th>
                      <th>Paid bills</th>
                      <th>Late</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {full.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{p.paidCount}</td>
                        <td>{p.lateCount}</td>
                        <td>{Math.round(p.lateRate * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

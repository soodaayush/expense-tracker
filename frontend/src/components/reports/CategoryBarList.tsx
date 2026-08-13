import { CategoryTotal } from "../../lib/reportStats";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

interface CategoryBarListProps {
  title: string;
  bars: CategoryTotal[]; // capped/folded (e.g. top 8 + "Other") for the chart itself
  full: CategoryTotal[]; // uncapped, for the table view
  emptyLabel: string;
}

export default function CategoryBarList({ title, bars, full, emptyLabel }: CategoryBarListProps) {
  const max = Math.max(1, ...bars.map((c) => c.total));

  return (
    <div className="report-card">
      <h3>{title}</h3>
      {bars.length === 0 ? (
        <p className="report-empty">{emptyLabel}</p>
      ) : (
        <>
          <div className="bar-list">
            {bars.map((c) => (
              <div className="bar-row" key={c.name}>
                <span className="bar-label" title={c.name}>
                  {c.name}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.total / max) * 100}%` }} />
                </div>
                <span className="bar-value">{currency.format(c.total)}</span>
              </div>
            ))}
          </div>
          <details className="report-table-toggle">
            <summary>View as table ({full.length})</summary>
            <div className="table-scroll">
              <table className="bills-table report-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Bills</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {full.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.count}</td>
                      <td>{currency.format(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

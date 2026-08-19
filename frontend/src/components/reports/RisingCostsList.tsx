import { RisingCost } from "../../lib/reportStats";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default function RisingCostsList({ costs }: { costs: RisingCost[] }) {
  return (
    <div className="report-card">
      <h3>Rising costs</h3>
      {costs.length === 0 ? (
        <p className="report-empty">No payee's recent bill stands out above their usual amount.</p>
      ) : (
        <div className="rising-cost-list">
          {costs.map((c) => (
            <div className="rising-cost-row" key={c.name}>
              <span className="rising-cost-name" title={c.name}>
                {c.name}
              </span>
              <span className="rising-cost-amounts">
                {currency.format(c.previousAmount)} <span aria-hidden="true">→</span> {currency.format(c.recentAmount)}
              </span>
              <span className="rising-cost-badge">+{Math.round(c.increasePct * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

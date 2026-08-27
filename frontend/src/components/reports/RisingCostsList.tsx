import { formatDateShort, RisingCost } from "../../lib/reportStats";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

// A single historical bill means "previous average" is really just one prior bill, so the jump
// is necessarily a one-shot before/after — there's no earlier span to have risen gradually
// across. Once there are 2+ historical bills spanning real calendar time, the same increase
// could equally be one sudden jump on the most recent bill or a slow creep across all of them,
// which is exactly the ambiguity the user asked to be able to tell apart.
function trendLabel(c: RisingCost): string {
  if (c.historicalStartDate === c.historicalEndDate) {
    return `Jumped from ${formatDateShort(c.historicalEndDate)} to ${formatDateShort(c.recentDate)}`;
  }
  return `Steady ${formatDateShort(c.historicalStartDate)} – ${formatDateShort(c.historicalEndDate)}, then jumped by ${formatDateShort(
    c.recentDate
  )}`;
}

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
              <span className="rising-cost-trend">{trendLabel(c)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

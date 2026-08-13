import { useMemo } from "react";
import { Link } from "react-router-dom";
import CategoryBarList from "../components/reports/CategoryBarList";
import SpendingTrendChart from "../components/reports/SpendingTrendChart";
import StatTile from "../components/reports/StatTile";
import TimelinessBar from "../components/reports/TimelinessBar";
import { useBillsQuery } from "../hooks/useBills";
import { usePrivacyMode } from "../hooks/usePrivacyMode";
import { computeReportStats, topCategoriesWithOther } from "../lib/reportStats";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const MAX_BARS = 8;

export default function ReportsPage() {
  const billsQuery = useBillsQuery();
  const { privacyMode, toggle: togglePrivacyMode } = usePrivacyMode();
  const bills = billsQuery.data ?? [];

  const stats = useMemo(() => computeReportStats(bills), [bills]);
  const payeeBars = useMemo(() => topCategoriesWithOther(stats.byPayee, MAX_BARS), [stats.byPayee]);
  const methodBars = useMemo(() => topCategoriesWithOther(stats.byPaymentMethod, MAX_BARS), [stats.byPaymentMethod]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Reports</h1>
        <nav className="page-nav">
          <button
            className={`btn-link${privacyMode ? " btn-chip-active" : ""}`}
            onClick={togglePrivacyMode}
            aria-pressed={privacyMode}
            title={privacyMode ? "Show report details" : "Hide report details"}
          >
            {privacyMode ? "🙈 Unhide" : "🙈 Privacy"}
          </button>
          <Link to="/" className="btn-link">
            Back to bills
          </Link>
        </nav>
      </header>

      {billsQuery.isLoading && <p>Loading bills…</p>}
      {billsQuery.isError && <p className="auth-error">Failed to load bills.</p>}

      {billsQuery.data && bills.length === 0 && (
        <p className="report-empty">No bills yet — reports will fill in once you add some.</p>
      )}

      {billsQuery.data && bills.length > 0 && (
        <div className={privacyMode ? "privacy-blur" : ""}>
          <div className="reports-grid">
            <StatTile label="Total paid" value={currency.format(stats.totalPaid)} />
            <StatTile
              label="Outstanding"
              value={currency.format(stats.totalUnpaid)}
              sub={`${stats.unpaidCount} unpaid bill${stats.unpaidCount === 1 ? "" : "s"}`}
            />
            <StatTile label="Average bill" value={currency.format(stats.averageAmount)} />
            <StatTile
              label="On-time rate"
              value={`${Math.round(stats.timeliness.onTimeRate * 100)}%`}
              sub={`${stats.timeliness.onTimeCount + stats.timeliness.lateCount} paid bill${
                stats.timeliness.onTimeCount + stats.timeliness.lateCount === 1 ? "" : "s"
              }`}
            />
          </div>

          <SpendingTrendChart data={stats.monthlySpend} />

          <TimelinessBar stats={stats.timeliness} />

          <div className="reports-columns">
            <CategoryBarList
              title="Spending by payee"
              bars={payeeBars}
              full={stats.byPayee}
              emptyLabel="No bills yet."
            />
            <CategoryBarList
              title="Spending by payment method"
              bars={methodBars}
              full={stats.byPaymentMethod}
              emptyLabel="No bills yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}

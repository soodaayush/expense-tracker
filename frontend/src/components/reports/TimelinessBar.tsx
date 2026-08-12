import { TimelinessStats } from "../../lib/reportStats";

export default function TimelinessBar({ stats }: { stats: TimelinessStats }) {
  const total = stats.onTimeCount + stats.lateCount;

  return (
    <div className="report-card">
      <h3>Payment timeliness</h3>
      {total === 0 ? (
        <p className="report-empty">No paid bills yet — this fills in once bills are marked paid.</p>
      ) : (
        <>
          <div className="timeliness-track">
            {stats.onTimeCount > 0 && (
              <div
                className="timeliness-segment timeliness-on-time"
                style={{ width: `${(stats.onTimeCount / total) * 100}%` }}
              />
            )}
            {stats.lateCount > 0 && (
              <div
                className="timeliness-segment timeliness-late"
                style={{ width: `${(stats.lateCount / total) * 100}%` }}
              />
            )}
          </div>
          <div className="timeliness-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-good" /> On time ({stats.onTimeCount})
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-critical" /> Late ({stats.lateCount})
            </span>
            <strong>{Math.round(stats.onTimeRate * 100)}% on time</strong>
          </div>
        </>
      )}
    </div>
  );
}

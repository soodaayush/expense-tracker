import { useState } from "react";
import { formatMonthShort, MonthlySpend, niceMax } from "../../lib/reportStats";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const currencyCompact = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

// Layout constants for the hand-rolled SVG line chart — a fixed per-month band width keeps
// spacing consistent regardless of how many months there are; the chart scrolls horizontally
// instead of squishing when there are many.
const BAND = 64;
const LEFT_AXIS_WIDTH = 52;
const RIGHT_PADDING = 32;
const TOP_PADDING = 28;
const PLOT_HEIGHT = 180;
const AXIS_LABEL_HEIGHT = 26;

interface SpendingTrendChartProps {
  data: MonthlySpend[];
  monthOverMonthChangePct?: number | null;
}

export default function SpendingTrendChart({ data, monthOverMonthChangePct }: SpendingTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="report-card">
        <h3>Spending over time</h3>
        <p className="report-empty">No paid bills yet — this fills in once bills are marked paid.</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...data.map((d) => d.total)));
  const plotWidth = Math.max((data.length - 1) * BAND, BAND);
  const width = LEFT_AXIS_WIDTH + plotWidth + RIGHT_PADDING;
  const height = TOP_PADDING + PLOT_HEIGHT + AXIS_LABEL_HEIGHT;

  const x = (i: number) => LEFT_AXIS_WIDTH + (data.length === 1 ? plotWidth / 2 : i * BAND);
  const y = (value: number) => TOP_PADDING + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;

  const linePoints = data.map((d, i) => `${x(i)},${y(d.total)}`).join(" ");
  const areaPoints = `${x(0)},${y(0)} ${linePoints} ${x(data.length - 1)},${y(0)}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const lastIndex = data.length - 1;
  const display = data[hoverIndex ?? lastIndex];

  return (
    <div className="report-card">
      <div className="report-card-header">
        <h3>Spending over time</h3>
        {monthOverMonthChangePct != null && (
          <span className="trend-delta">
            {monthOverMonthChangePct >= 0 ? "▲" : "▼"} {Math.abs(Math.round(monthOverMonthChangePct * 100))}% vs last
            month
          </span>
        )}
      </div>
      <div className="trend-scroll">
        <svg width={width} height={height} role="img" aria-label="Total amount paid per month">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT_AXIS_WIDTH} x2={width - RIGHT_PADDING} y1={y(t)} y2={y(t)} className="chart-gridline" />
              <text x={LEFT_AXIS_WIDTH - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis-label">
                {currencyCompact.format(t)}
              </text>
            </g>
          ))}
          <line x1={LEFT_AXIS_WIDTH} x2={width - RIGHT_PADDING} y1={y(0)} y2={y(0)} className="chart-baseline" />
          <polygon points={areaPoints} className="chart-area" />
          <polyline points={linePoints} className="chart-line" />
          {data.map((d, i) => (
            <g key={d.month}>
              <circle cx={x(i)} cy={y(d.total)} r={4} className="chart-dot" />
              {i === lastIndex && (
                <text x={x(i) + 4} y={y(d.total) - 12} textAnchor="end" className="chart-point-label">
                  {currency.format(d.total)}
                </text>
              )}
              <text x={x(i)} y={height - 6} textAnchor="middle" className="chart-axis-label">
                {formatMonthShort(d.month)}
              </text>
              <rect
                x={x(i) - BAND / 2}
                y={TOP_PADDING}
                width={BAND}
                height={PLOT_HEIGHT}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${formatMonthShort(d.month)}: ${currency.format(d.total)}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
              />
            </g>
          ))}
          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={TOP_PADDING}
              y2={TOP_PADDING + PLOT_HEIGHT}
              className="chart-crosshair"
            />
          )}
        </svg>
      </div>
      <div className="chart-readout" role="status">
        <strong>{currency.format(display.total)}</strong>
        <span>{formatMonthShort(display.month)}</span>
      </div>
    </div>
  );
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Always construct/read dates via local year/month/day components (never `new Date(isoString)`,
// which parses as UTC midnight and can render as the wrong day depending on the user's timezone).
export function parseISODate(value: string): Date | null {
  const match = ISO_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return date;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const weekdayLabels = WEEKDAY_LABELS;

// Returns a flat 42-cell (6 week) grid of dates covering the given month, including the
// leading/trailing days from adjacent months needed to fill complete weeks.
export function monthGrid(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

const DISPLAY_FORMAT = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" });
const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export function formatDisplayDate(value: string): string {
  const date = parseISODate(value);
  return date ? DISPLAY_FORMAT.format(date) : "";
}

export function formatMonthLabel(date: Date): string {
  return MONTH_FORMAT.format(date);
}

// Groups an ISO "YYYY-MM-DD" date into its calendar quarter, e.g. "2026-Q1". Built from the
// string directly (not parseISODate) since callers only ever have the raw date string on hand
// and quarter buckets are naturally comparable/sortable as plain strings in this format.
export function quarterKey(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const quarter = Math.ceil(Number(isoDate.slice(5, 7)) / 3);
  return `${year}-Q${quarter}`;
}

export function formatQuarterLabel(key: string): string {
  const [year, quarter] = key.split("-Q");
  return `Q${quarter} ${year}`;
}

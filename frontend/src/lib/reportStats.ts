import { Bill } from "../types/bill";

export interface MonthlySpend {
  month: string; // "YYYY-MM"
  total: number;
}

export interface CategoryTotal {
  name: string;
  total: number;
  count: number;
}

export interface TimelinessStats {
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number; // 0..1, 0 when there are no paid bills yet
  avgDaysDiff: number; // mean of (paidDate - dueDate) in days across paid bills; positive = late, negative = early
}

export interface PayeeLateStats {
  name: string;
  lateCount: number;
  paidCount: number;
  lateRate: number; // 0..1
}

export interface RisingCost {
  name: string;
  previousAmount: number; // average of this payee's bills before the most recent one
  recentAmount: number; // most recent bill's amount
  increasePct: number; // e.g. 0.19 = 19% above the historical average
  historicalStartDate: string; // due date of the earliest bill the historical average covers
  historicalEndDate: string; // due date of the latest bill the historical average covers
  recentDate: string; // due date of the most recent (elevated) bill
}

export interface OnTimeStreak {
  count: number;
  startDate: string | null; // due date of the oldest bill in the current streak
  endDate: string | null; // due date of the most recent bill in the current streak
}

export interface ReportStats {
  totalPaid: number;
  totalUnpaid: number;
  unpaidCount: number;
  averageAmount: number;
  monthlySpend: MonthlySpend[];
  byPayee: CategoryTotal[];
  byPaymentMethod: CategoryTotal[];
  timeliness: TimelinessStats;
  lateByPayee: PayeeLateStats[];
  concentrationTop3Pct: number; // 0..1, share of total spend from the top 3 payees
  monthOverMonthChangePct: number | null; // null when there's under 2 months of data to compare
  risingCosts: RisingCost[];
  onTimeStreak: OnTimeStreak;
}

// Plain "YYYY-MM-DD" date-math — UTC-anchored so it's just counting calendar days, not
// affected by any timezone (matches how these strings are otherwise treated as pure dates).
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

// A bill counts as "rising cost" material only once a payee has enough history to have an
// average to compare against, and only once the jump clears this floor — otherwise ordinary
// bill-to-bill noise (a slightly bigger grocery trip) would flag constantly and the watchlist
// would stop meaning anything.
const RISING_COST_THRESHOLD = 0.15;
const MAX_RISING_COSTS = 5;

export function computeReportStats(bills: Bill[]): ReportStats {
  let totalPaid = 0;
  let totalUnpaid = 0;
  let unpaidCount = 0;
  let amountSum = 0;
  let amountCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let daysDiffSum = 0;

  const monthlyMap = new Map<string, number>();
  const payeeMap = new Map<string, { total: number; count: number }>();
  const methodMap = new Map<string, { total: number; count: number }>();
  const payeeLateMap = new Map<string, { lateCount: number; paidCount: number }>();
  const payeeBillsMap = new Map<string, Bill[]>();

  function addToMap(map: Map<string, { total: number; count: number }>, key: string, amount: number) {
    const entry = map.get(key) ?? { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    map.set(key, entry);
  }

  for (const bill of bills) {
    const amount = bill.amount ?? 0;
    amountSum += amount;
    amountCount += 1;

    if (!payeeBillsMap.has(bill.payee)) payeeBillsMap.set(bill.payee, []);
    payeeBillsMap.get(bill.payee)!.push(bill);

    if (bill.paidDate) {
      totalPaid += amount;
      const month = bill.paidDate.slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amount);

      const diff = daysBetween(bill.dueDate, bill.paidDate);
      daysDiffSum += diff;
      const isLate = diff > 0;
      if (isLate) lateCount += 1;
      else onTimeCount += 1;

      const lateEntry = payeeLateMap.get(bill.payee) ?? { lateCount: 0, paidCount: 0 };
      lateEntry.paidCount += 1;
      if (isLate) lateEntry.lateCount += 1;
      payeeLateMap.set(bill.payee, lateEntry);
    } else {
      totalUnpaid += amount;
      unpaidCount += 1;
    }

    addToMap(payeeMap, bill.payee, amount);
    addToMap(methodMap, bill.paymentMethod ?? "Unspecified", amount);
  }

  const monthlySpend = [...monthlyMap.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const toSortedCategories = (map: Map<string, { total: number; count: number }>): CategoryTotal[] =>
    [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

  const byPayee = toSortedCategories(payeeMap);
  const paidCount = onTimeCount + lateCount;

  const lateByPayee: PayeeLateStats[] = [...payeeLateMap.entries()]
    .map(([name, v]) => ({ name, lateCount: v.lateCount, paidCount: v.paidCount, lateRate: v.lateCount / v.paidCount }))
    .filter((p) => p.lateCount > 0)
    .sort((a, b) => b.lateCount - a.lateCount);

  const top3Total = byPayee.slice(0, 3).reduce((sum, p) => sum + p.total, 0);
  const concentrationTop3Pct = amountSum > 0 ? top3Total / amountSum : 0;

  let monthOverMonthChangePct: number | null = null;
  if (monthlySpend.length >= 2) {
    const latest = monthlySpend[monthlySpend.length - 1].total;
    const previous = monthlySpend[monthlySpend.length - 2].total;
    monthOverMonthChangePct = previous > 0 ? (latest - previous) / previous : null;
  }

  const risingCosts: RisingCost[] = [];
  for (const [name, payeeBills] of payeeBillsMap) {
    const withAmounts = payeeBills.filter((b) => b.amount != null).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (withAmounts.length < 2) continue;
    const recent = withAmounts[withAmounts.length - 1];
    const historical = withAmounts.slice(0, -1);
    const historicalAvg = mean(historical.map((b) => b.amount as number));
    if (historicalAvg <= 0) continue;
    const recentAmount = recent.amount as number;
    const increasePct = (recentAmount - historicalAvg) / historicalAvg;
    if (increasePct >= RISING_COST_THRESHOLD) {
      risingCosts.push({
        name,
        previousAmount: historicalAvg,
        recentAmount,
        increasePct,
        historicalStartDate: historical[0].dueDate,
        historicalEndDate: historical[historical.length - 1].dueDate,
        recentDate: recent.dueDate,
      });
    }
  }
  risingCosts.sort((a, b) => b.increasePct - a.increasePct);
  risingCosts.splice(MAX_RISING_COSTS);

  // Walk paid bills most-recent-first and count consecutive on-time payments — stops at the
  // first late one (or the start of history), so a single late payment resets it to 0 even if
  // every payment before that was on time.
  const paidBillsByRecency = bills
    .filter((b) => b.paidDate)
    .sort((a, b) => (b.paidDate as string).localeCompare(a.paidDate as string));
  let onTimeStreakCount = 0;
  let onTimeStreakStart: string | null = null;
  const onTimeStreakEnd = paidBillsByRecency[0]?.paidDate ?? null;
  for (const bill of paidBillsByRecency) {
    if (daysBetween(bill.dueDate, bill.paidDate as string) > 0) break;
    onTimeStreakCount += 1;
    onTimeStreakStart = bill.paidDate as string;
  }
  const onTimeStreak: OnTimeStreak = {
    count: onTimeStreakCount,
    startDate: onTimeStreakCount > 0 ? onTimeStreakStart : null,
    endDate: onTimeStreakCount > 0 ? onTimeStreakEnd : null,
  };

  return {
    totalPaid,
    totalUnpaid,
    unpaidCount,
    averageAmount: amountCount > 0 ? amountSum / amountCount : 0,
    monthlySpend,
    byPayee,
    byPaymentMethod: toSortedCategories(methodMap),
    timeliness: {
      onTimeCount,
      lateCount,
      onTimeRate: paidCount > 0 ? onTimeCount / paidCount : 0,
      avgDaysDiff: paidCount > 0 ? daysDiffSum / paidCount : 0,
    },
    lateByPayee,
    concentrationTop3Pct,
    monthOverMonthChangePct,
    risingCosts,
    onTimeStreak,
  };
}

// Caps a sorted-descending category list at `max` bars, folding the remainder into a single
// "Other" bucket — keeps bar charts within the categorical series ladder's token ceiling
// (see the dataviz skill's series-count guidance) instead of growing without bound.
export function topCategoriesWithOther(categories: CategoryTotal[], max: number): CategoryTotal[] {
  if (categories.length <= max) return categories;
  const top = categories.slice(0, max);
  const rest = categories.slice(max);
  return [
    ...top,
    {
      name: "Other",
      total: rest.reduce((sum, c) => sum + c.total, 0),
      count: rest.reduce((sum, c) => sum + c.count, 0),
    },
  ];
}

// Rounds a chart's max value up to a "nice" 1/2/5 * 10^n step so axis ticks land on clean
// numbers instead of whatever the raw data maximum happens to be.
export function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return niceResidual * magnitude;
}

export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export function formatMonthShort(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(
    new Date(year, month - 1, 1)
  );
}

export function formatAvgDaysDiff(avgDaysDiff: number): string {
  if (Math.abs(avgDaysDiff) < 0.05) return "On time";
  const rounded = Math.abs(avgDaysDiff).toFixed(1);
  return avgDaysDiff > 0 ? `${rounded}d late` : `${rounded}d early`;
}

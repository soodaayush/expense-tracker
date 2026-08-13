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
}

export function computeReportStats(bills: Bill[]): ReportStats {
  let totalPaid = 0;
  let totalUnpaid = 0;
  let unpaidCount = 0;
  let amountSum = 0;
  let amountCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;

  const monthlyMap = new Map<string, number>();
  const payeeMap = new Map<string, { total: number; count: number }>();
  const methodMap = new Map<string, { total: number; count: number }>();

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

    if (bill.paidDate) {
      totalPaid += amount;
      const month = bill.paidDate.slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amount);
      if (bill.paidDate > bill.dueDate) lateCount += 1;
      else onTimeCount += 1;
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

  const paidCount = onTimeCount + lateCount;

  return {
    totalPaid,
    totalUnpaid,
    unpaidCount,
    averageAmount: amountCount > 0 ? amountSum / amountCount : 0,
    monthlySpend,
    byPayee: toSortedCategories(payeeMap),
    byPaymentMethod: toSortedCategories(methodMap),
    timeliness: {
      onTimeCount,
      lateCount,
      onTimeRate: paidCount > 0 ? onTimeCount / paidCount : 0,
    },
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

export function formatMonthShort(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(
    new Date(year, month - 1, 1)
  );
}

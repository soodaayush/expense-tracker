import { useMemo } from "react";
import { Bill } from "../../types/bill";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default function TotalsBar({ bills }: { bills: Bill[] }) {
  const unpaidTotal = useMemo(
    () => bills.filter((b) => !b.paidDate).reduce((sum, b) => sum + (b.amount ?? 0), 0),
    [bills]
  );
  const unpaidCount = useMemo(() => bills.filter((b) => !b.paidDate).length, [bills]);

  return (
    <div className="totals-bar">
      <span>{unpaidCount} unpaid</span>
      <strong>Unpaid total: {currency.format(unpaidTotal)}</strong>
    </div>
  );
}

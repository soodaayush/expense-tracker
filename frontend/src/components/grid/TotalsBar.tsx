import { useMemo } from "react";
import { Bill } from "../../types/bill";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default function TotalsBar({ bills, censored = false }: { bills: Bill[]; censored?: boolean }) {
  const unpaidTotal = useMemo(
    () => bills.filter((b) => !b.paidDate).reduce((sum, b) => sum + (b.amount ?? 0), 0),
    [bills]
  );
  const unpaidCount = useMemo(() => bills.filter((b) => !b.paidDate).length, [bills]);

  return (
    <div className="totals-bar">
      <span className={censored ? "privacy-blur" : ""}>{unpaidCount} unpaid</span>
      <strong className={censored ? "privacy-blur" : ""}>Unpaid total: {currency.format(unpaidTotal)}</strong>
    </div>
  );
}

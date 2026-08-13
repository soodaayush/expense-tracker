import { Bill } from "../types/bill";

const HEADERS = ["Payee", "Payment Method", "Amount", "Due Date", "Paid Date", "Notes"];

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function billsToCsv(bills: Bill[]): string {
  const lines = bills.map((bill) =>
    [
      bill.payee,
      bill.paymentMethod ?? "",
      bill.amount != null ? String(bill.amount) : "",
      bill.dueDate,
      bill.paidDate ?? "",
      bill.notes,
    ]
      .map(escapeCsvField)
      .join(",")
  );
  return [HEADERS.join(","), ...lines].join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

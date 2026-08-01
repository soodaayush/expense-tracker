import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useCreateBill, useDeleteBill, useUpdateBill } from "../../hooks/useBills";
import { useAddPayee, usePayeesQuery } from "../../hooks/usePayees";
import { sanitizeAmountInput } from "../../lib/numberInput";
import { Bill } from "../../types/bill";
import DatePicker from "./DatePicker";
import EditableCell from "./EditableCell";
import PayeeSelect from "./PayeeSelect";
import RowActions from "./RowActions";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function isPastDue(bill: Bill): boolean {
  if (bill.paidDate) return false;
  return bill.dueDate < new Date().toISOString().slice(0, 10);
}

type StatusFilter = "all" | "unpaid" | "paid";

const emptyDraft = { payee: "", amount: "", dueDate: "", paidDate: "", notes: "" };

export default function BillsGrid({ bills }: { bills: Bill[] }) {
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const createBill = useCreateBill();
  const payeesQuery = usePayeesQuery();
  const addPayee = useAddPayee();
  const payeeOptions = payeesQuery.data ?? [];

  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: true }]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draft, setDraft] = useState(emptyDraft);
  const [addError, setAddError] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (statusFilter === "unpaid" && bill.paidDate) return false;
      if (statusFilter === "paid" && !bill.paidDate) return false;
      if (search && !bill.payee.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [bills, search, statusFilter]);

  function patch(id: string, field: string, value: string) {
    if (field === "amount") {
      updateBill.mutate({ id, patch: { amount: value === "" ? null : Number(value) } });
    } else if (field === "paidDate") {
      updateBill.mutate({ id, patch: { paidDate: value === "" ? null : value } });
    } else {
      updateBill.mutate({ id, patch: { [field]: value } });
    }
  }

  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        id: "payee",
        header: "Payee",
        accessorKey: "payee",
        enableSorting: true,
        cell: ({ row }) => (
          <PayeeSelect
            value={row.original.payee}
            options={payeeOptions}
            label="Payee"
            onCommit={(v) => patch(row.original.id, "payee", v)}
            onAddOption={(v) => addPayee.mutate(v)}
          />
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (b) => b.amount ?? "",
        enableSorting: true,
        cell: ({ row }) => (
          <EditableCell
            type="number"
            align="right"
            label="Amount"
            value={row.original.amount?.toString() ?? ""}
            displayValue={row.original.amount != null ? currency.format(row.original.amount) : ""}
            onCommit={(v) => patch(row.original.id, "amount", v)}
          />
        ),
      },
      {
        id: "dueDate",
        header: "Due Date",
        accessorKey: "dueDate",
        enableSorting: true,
        cell: ({ row }) => (
          <DatePicker
            label="Due date"
            placeholder="Select date"
            value={row.original.dueDate}
            onCommit={(v) => patch(row.original.id, "dueDate", v)}
          />
        ),
      },
      {
        id: "paidDate",
        header: "Paid Date",
        accessorFn: (b) => b.paidDate ?? "",
        enableSorting: true,
        cell: ({ row }) => (
          <DatePicker
            label="Paid date"
            value={row.original.paidDate ?? ""}
            placeholder="Unpaid"
            onCommit={(v) => patch(row.original.id, "paidDate", v)}
          />
        ),
      },
      {
        id: "notes",
        header: "Notes",
        accessorKey: "notes",
        enableSorting: false,
        cell: ({ row }) => (
          <EditableCell label="Notes" value={row.original.notes} onCommit={(v) => patch(row.original.id, "notes", v)} />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions
            bill={row.original}
            onTogglePaid={() =>
              updateBill.mutate({
                id: row.original.id,
                patch: { paidDate: row.original.paidDate ? null : new Date().toISOString().slice(0, 10) },
              })
            }
            onDelete={() => deleteBill.mutate(row.original.id)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateBill, deleteBill, payeeOptions, addPayee]
  );

  const table = useReactTable({
    data: filteredBills,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function handleAdd() {
    setAddError(null);
    if (!draft.payee.trim()) {
      setAddError("Payee is required");
      return;
    }
    if (!draft.dueDate) {
      setAddError("Due date is required");
      return;
    }
    createBill.mutate({
      payee: draft.payee.trim(),
      amount: draft.amount === "" ? null : Number(draft.amount),
      dueDate: draft.dueDate,
      paidDate: draft.paidDate === "" ? null : draft.paidDate,
      notes: draft.notes,
    });
    setDraft(emptyDraft);
  }

  return (
    <div className="grid-wrapper">
      <div className="grid-toolbar">
        <input
          className="search-input"
          placeholder="Search payee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="status-filter">
          {(["all", "unpaid", "paid"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              className={`btn-chip${statusFilter === status ? " btn-chip-active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="add-row">
        <div className="field">
          <label htmlFor="add-payee">Payee</label>
          <PayeeSelect
            id="add-payee"
            label="Payee"
            value={draft.payee}
            options={payeeOptions}
            placeholder="Payee"
            onCommit={(v) => setDraft((d) => ({ ...d, payee: v }))}
            onAddOption={(v) => addPayee.mutate(v)}
          />
        </div>
        <div className="field">
          <label htmlFor="add-amount">Amount</label>
          <input
            id="add-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: sanitizeAmountInput(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="add-due-date">Due date</label>
          <DatePicker
            id="add-due-date"
            label="Due date"
            placeholder="Select date"
            value={draft.dueDate}
            onCommit={(v) => setDraft((d) => ({ ...d, dueDate: v }))}
          />
        </div>
        <div className="field">
          <label htmlFor="add-paid-date">Paid date</label>
          <DatePicker
            id="add-paid-date"
            label="Paid date"
            placeholder="Unpaid"
            value={draft.paidDate}
            onCommit={(v) => setDraft((d) => ({ ...d, paidDate: v }))}
          />
        </div>
        <div className="field">
          <label htmlFor="add-notes">Notes</label>
          <input
            id="add-notes"
            placeholder="Notes"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
        <div className="field">
          <button className="btn btn-primary" onClick={handleAdd}>
            + Add bill
          </button>
        </div>
      </div>
      {addError && (
        <div className="grid-inset">
          <p className="auth-error">{addError}</p>
        </div>
      )}

      <div className="table-scroll">
      <table className="bills-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={header.column.getCanSort() ? "sortable" : ""}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={isPastDue(row.original) ? "row-past-due" : ""}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
          {filteredBills.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty-state">
                No bills yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

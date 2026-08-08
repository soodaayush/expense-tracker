import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useCreateBill, useDeleteBill, useUpdateBill } from "../../hooks/useBills";
import { useAddPayee, usePayeesQuery } from "../../hooks/usePayees";
import { useAddPaymentMethod, usePaymentMethodsQuery } from "../../hooks/usePaymentMethods";
import { sanitizeAmountInput } from "../../lib/numberInput";
import { Bill } from "../../types/bill";
import ComboSelect from "./ComboSelect";
import DatePicker from "./DatePicker";
import EditableCell from "./EditableCell";
import RowActions from "./RowActions";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function isPastDue(bill: Bill): boolean {
  if (bill.paidDate) return false;
  return bill.dueDate < new Date().toISOString().slice(0, 10);
}

type StatusFilter = "all" | "unpaid" | "paid";

const emptyDraft = { payee: "", paymentMethod: "", amount: "", dueDate: "", paidDate: "", notes: "" };

export default function BillsGrid({ bills }: { bills: Bill[] }) {
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const createBill = useCreateBill();
  const payeesQuery = usePayeesQuery();
  const addPayee = useAddPayee();
  const payeeOptions = (payeesQuery.data ?? []).map((p) => p.name);
  const paymentMethodsQuery = usePaymentMethodsQuery();
  const addPaymentMethod = useAddPaymentMethod();
  const paymentMethodOptions = (paymentMethodsQuery.data ?? []).map((p) => p.name);

  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 100 });
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

  // Narrowing the filter/search can leave a previously-valid page index pointing past the end
  // of the new result set — jump back to page 1 whenever what's being filtered changes.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [search, statusFilter]);

  function patch(id: string, field: string, value: string) {
    if (field === "amount") {
      updateBill.mutate({ id, patch: { amount: value === "" ? null : Number(value) } });
    } else if (field === "paidDate") {
      updateBill.mutate({ id, patch: { paidDate: value === "" ? null : value } });
    } else if (field === "paymentMethod") {
      updateBill.mutate({ id, patch: { paymentMethod: value === "" ? null : value } });
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
          <ComboSelect
            value={row.original.payee}
            options={payeeOptions}
            label="Payee"
            onCommit={(v) => patch(row.original.id, "payee", v)}
            onAddOption={(v) => addPayee.mutate(v)}
          />
        ),
      },
      {
        id: "paymentMethod",
        header: "Payment Method",
        accessorFn: (b) => b.paymentMethod ?? "",
        enableSorting: true,
        cell: ({ row }) => (
          <ComboSelect
            value={row.original.paymentMethod ?? ""}
            options={paymentMethodOptions}
            placeholder="—"
            label="Payment method"
            allowClear
            onCommit={(v) => patch(row.original.id, "paymentMethod", v)}
            onAddOption={(v) => addPaymentMethod.mutate(v)}
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
    [updateBill, deleteBill, payeeOptions, addPayee, paymentMethodOptions, addPaymentMethod]
  );

  const table = useReactTable({
    data: filteredBills,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
      paymentMethod: draft.paymentMethod === "" ? null : draft.paymentMethod,
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
          <ComboSelect
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
          <label htmlFor="add-payment-method">Payment method</label>
          <ComboSelect
            id="add-payment-method"
            label="Payment method"
            value={draft.paymentMethod}
            options={paymentMethodOptions}
            placeholder="—"
            allowClear
            onCommit={(v) => setDraft((d) => ({ ...d, paymentMethod: v }))}
            onAddOption={(v) => addPaymentMethod.mutate(v)}
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

      {table.getPageCount() > 1 && (
        <div className="grid-pager">
          <button
            className="btn-link"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
            {filteredBills.length} bills)
          </span>
          <button className="btn-link" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

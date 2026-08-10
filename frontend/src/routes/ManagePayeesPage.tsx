import { useState } from "react";
import { Link } from "react-router-dom";
import EditableCell from "../components/grid/EditableCell";
import { useBillsQuery } from "../hooks/useBills";
import { useDeletePayee, usePayeesQuery, useUpdatePayee } from "../hooks/usePayees";

export default function ManagePayeesPage() {
  const payeesQuery = usePayeesQuery();
  const billsQuery = useBillsQuery();
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();

  const [message, setMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const payees = payeesQuery.data ?? [];
  const bills = billsQuery.data ?? [];

  function billCountFor(payeeId: string): number {
    return bills.filter((b) => b.payeeId === payeeId).length;
  }

  function handleRename(id: string, name: string) {
    setMessage(null);
    updatePayee.mutate(
      { id, name },
      { onError: (err) => setMessage(err instanceof Error ? err.message : "Failed to rename payee") }
    );
  }

  function handleDelete(id: string) {
    setMessage(null);
    setConfirmingId(null);
    deletePayee.mutate(id, {
      onError: (err) => setMessage(err instanceof Error ? err.message : "Failed to delete payee"),
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Manage Payees</h1>
        <Link to="/" className="btn-link">
          Back to bills
        </Link>
      </header>

      {message && (
        <div className="grid-inset">
          <p className="auth-error">{message}</p>
        </div>
      )}

      <div className="grid-wrapper">
        <div className="table-scroll">
          <table className="bills-table">
            <thead>
              <tr>
                <th>Payee</th>
                <th>Bills</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payees.map((payee) => (
                <tr key={payee.id}>
                  <td>
                    <EditableCell
                      label="Payee name"
                      value={payee.name}
                      onCommit={(name) => handleRename(payee.id, name)}
                    />
                  </td>
                  <td>{billCountFor(payee.id)}</td>
                  <td>
                    {confirmingId === payee.id ? (
                      <span className="row-confirm">
                        <button className="btn-chip btn-chip-danger" onClick={() => handleDelete(payee.id)}>
                          Confirm
                        </button>
                        <button className="btn-chip" onClick={() => setConfirmingId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button className="btn-chip" onClick={() => setConfirmingId(payee.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payees.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No payees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

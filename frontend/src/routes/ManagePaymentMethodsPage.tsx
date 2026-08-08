import { useState } from "react";
import { Link } from "react-router-dom";
import EditableCell from "../components/grid/EditableCell";
import { useBillsQuery } from "../hooks/useBills";
import { useDeletePaymentMethod, usePaymentMethodsQuery, useUpdatePaymentMethod } from "../hooks/usePaymentMethods";

export default function ManagePaymentMethodsPage() {
  const paymentMethodsQuery = usePaymentMethodsQuery();
  const billsQuery = useBillsQuery();
  const updatePaymentMethod = useUpdatePaymentMethod();
  const deletePaymentMethod = useDeletePaymentMethod();

  const [message, setMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const paymentMethods = paymentMethodsQuery.data ?? [];
  const bills = billsQuery.data ?? [];

  function billCountFor(paymentMethodId: string): number {
    return bills.filter((b) => b.paymentMethodId === paymentMethodId).length;
  }

  function handleRename(id: string, name: string) {
    setMessage(null);
    updatePaymentMethod.mutate(
      { id, name },
      { onError: (err) => setMessage(err instanceof Error ? err.message : "Failed to rename payment method") }
    );
  }

  function handleDelete(id: string) {
    setMessage(null);
    setConfirmingId(null);
    deletePaymentMethod.mutate(id, {
      onError: (err) => setMessage(err instanceof Error ? err.message : "Failed to delete payment method"),
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Manage Payment Methods</h1>
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
                <th>Payment method</th>
                <th>Bills</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((paymentMethod) => (
                <tr key={paymentMethod.id}>
                  <td>
                    <EditableCell
                      label="Payment method name"
                      value={paymentMethod.name}
                      onCommit={(name) => handleRename(paymentMethod.id, name)}
                    />
                  </td>
                  <td>{billCountFor(paymentMethod.id)}</td>
                  <td>
                    {confirmingId === paymentMethod.id ? (
                      <span className="row-confirm">
                        <button className="btn-chip btn-chip-danger" onClick={() => handleDelete(paymentMethod.id)}>
                          Confirm
                        </button>
                        <button className="btn-chip" onClick={() => setConfirmingId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button className="btn-chip" onClick={() => setConfirmingId(paymentMethod.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No payment methods yet.
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

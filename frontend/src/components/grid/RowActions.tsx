import { useState } from "react";
import { Bill } from "../../types/bill";

function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4.5 6h11M8 6V4.5h4V6m-6 0v9.5a1 1 0 001 1h6a1 1 0 001-1V6M8.5 9v5m3-5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RowActionsProps {
  bill: Bill;
  onTogglePaid: () => void;
  onDelete: () => void;
}

export default function RowActions({ bill, onTogglePaid, onDelete }: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="row-actions">
      <button
        className={`btn-chip${bill.paidDate ? " btn-chip-active" : ""}`}
        onClick={onTogglePaid}
        title={bill.paidDate ? "Mark unpaid" : "Mark paid"}
      >
        {bill.paidDate ? (
          <>
            <CheckIcon /> Paid
          </>
        ) : (
          "Mark paid"
        )}
      </button>
      {confirming ? (
        <span className="row-confirm">
          <button className="btn-chip btn-chip-danger" onClick={onDelete}>
            Confirm
          </button>
          <button className="btn-chip" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button className="btn-chip" onClick={() => setConfirming(true)} title="Delete row" aria-label="Delete row">
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addPasskey, logout } from "../api/auth";
import BillsGrid from "../components/grid/BillsGrid";
import TotalsBar from "../components/grid/TotalsBar";
import { useSession } from "../hooks/useSession";
import { useBillsQuery } from "../hooks/useBills";

export default function BillsPage() {
  const navigate = useNavigate();
  const { displayName, refresh } = useSession();
  const billsQuery = useBillsQuery();
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogout() {
    await logout();
    await refresh();
    navigate("/login", { replace: true });
  }

  async function handleAddPasskey() {
    const deviceLabel = window.prompt("Name this device (e.g. Phone, Laptop):") ?? undefined;
    setAddingPasskey(true);
    setMessage(null);
    try {
      await addPasskey({ deviceLabel });
      setMessage("Passkey added.");
    } catch (err) {
      setMessage(err instanceof Error ? `Failed: ${err.message}` : "Failed to add passkey");
    } finally {
      setAddingPasskey(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Bill Tracker{displayName ? ` — ${displayName}` : ""}</h1>
        <nav className="page-nav">
          <Link to="/import" className="btn-link">
            Import CSV
          </Link>
          <button className="btn-link" onClick={handleAddPasskey} disabled={addingPasskey}>
            Add passkey
          </button>
          <button className="btn-link" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      {message && <p className="page-message">{message}</p>}

      <TotalsBar bills={billsQuery.data ?? []} />

      {billsQuery.isLoading && <p>Loading bills…</p>}
      {billsQuery.isError && <p className="auth-error">Failed to load bills.</p>}
      {billsQuery.data && <BillsGrid bills={billsQuery.data} />}
    </div>
  );
}

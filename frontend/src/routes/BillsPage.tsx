import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAddPasskeyCredential, describeAuthError, fetchAddPasskeyOptions, logout, verifyAddPasskey } from "../api/auth";
import BillsGrid from "../components/grid/BillsGrid";
import TotalsBar from "../components/grid/TotalsBar";
import NavMenu from "../components/NavMenu";
import { useSession } from "../hooks/useSession";
import { useBillsQuery } from "../hooks/useBills";
import { usePrivacyMode } from "../hooks/usePrivacyMode";
import { billsToCsv, downloadCsv } from "../lib/csvExport";

export default function BillsPage() {
  const navigate = useNavigate();
  const { displayName, refresh } = useSession();
  const billsQuery = useBillsQuery();
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { privacyMode, toggle: togglePrivacyMode } = usePrivacyMode();

  async function handleLogout() {
    await logout();
    await refresh();
    navigate("/login", { replace: true });
  }

  function handleExport() {
    if (!billsQuery.data || billsQuery.data.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`bills-export-${today}.csv`, billsToCsv(billsQuery.data));
  }

  async function handleAddPasskey() {
    setAddingPasskey(true);
    setMessage(null);
    try {
      // The WebAuthn ceremony runs immediately after the click, before anything can block and
      // burn through the browser's transient-activation window — see fetchAddPasskeyOptions.
      const options = await fetchAddPasskeyOptions();
      const response = await createAddPasskeyCredential(options);
      const deviceLabel = window.prompt("Name this device (e.g. Phone, Laptop):") ?? undefined;
      await verifyAddPasskey(response, deviceLabel);
      setMessage("Passkey added.");
    } catch (err) {
      setMessage(`Failed: ${describeAuthError(err)}`);
    } finally {
      setAddingPasskey(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Bill Tracker{displayName ? ` — ${displayName}` : ""}</h1>
        <nav className="page-nav">
          <Link to="/reports" className="btn-link">
            Reports
          </Link>
          <button
            className={`btn-link${privacyMode ? " btn-chip-active" : ""}`}
            onClick={togglePrivacyMode}
            aria-pressed={privacyMode}
            title={privacyMode ? "Show bill details" : "Hide bill details"}
          >
            {privacyMode ? "🙈 Unhide" : "🙈 Privacy"}
          </button>
          <NavMenu label="Menu ▾">
            <Link to="/import" className="nav-menu-item">
              Import CSV
            </Link>
            <button
              type="button"
              className="nav-menu-item"
              onClick={handleExport}
              disabled={!billsQuery.data || billsQuery.data.length === 0}
            >
              Export CSV
            </button>
            <Link to="/payees" className="nav-menu-item">
              Manage Payees
            </Link>
            <Link to="/payment-methods" className="nav-menu-item">
              Manage Payment Methods
            </Link>
            <div className="nav-menu-divider" />
            <button type="button" className="nav-menu-item" onClick={handleAddPasskey} disabled={addingPasskey}>
              Add passkey
            </button>
            <button type="button" className="nav-menu-item" onClick={handleLogout}>
              Log out
            </button>
          </NavMenu>
        </nav>
      </header>

      {message && <p className="page-message">{message}</p>}

      <TotalsBar bills={billsQuery.data ?? []} censored={privacyMode} />

      {billsQuery.isLoading && <p>Loading bills…</p>}
      {billsQuery.isError && <p className="auth-error">Failed to load bills.</p>}
      {billsQuery.data && <BillsGrid bills={billsQuery.data} censored={privacyMode} />}
    </div>
  );
}

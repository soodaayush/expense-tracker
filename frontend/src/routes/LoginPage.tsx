import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginWithPasskey, registerPasskey } from "../api/auth";
import { useSession } from "../hooks/useSession";

export default function LoginPage() {
  const { authenticated, isLoading, refresh } = useSession();
  const navigate = useNavigate();

  const isLocalDev = window.location.hostname === "localhost";

  const [showSetup, setShowSetup] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isLoading && authenticated) return <Navigate to="/" replace />;

  async function handleLogin() {
    setError(null);
    setBusy(true);
    try {
      await loginWithPasskey();
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup() {
    setError(null);
    setBusy(true);
    try {
      await registerPasskey({ setupToken, deviceLabel: deviceLabel || undefined });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Bill Tracker</h1>
        <p className="auth-subtitle">Sign in with your passkey</p>

        <button className="btn btn-primary" onClick={handleLogin} disabled={busy}>
          Log in with passkey
        </button>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-link" onClick={() => setShowSetup((v) => !v)} type="button">
          {showSetup ? "Hide first-time setup" : "First time here? Set up a passkey"}
        </button>

        {showSetup && (
          <div className="auth-setup">
            {!isLocalDev && (
              <label>
                Setup token
                <input
                  type="password"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  placeholder="Value of SETUP_TOKEN"
                />
              </label>
            )}
            <label>
              Device name (optional)
              <input
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder="e.g. Laptop"
              />
            </label>
            <button
              className="btn btn-secondary"
              onClick={handleSetup}
              disabled={busy || (!isLocalDev && !setupToken)}
            >
              Register this device
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

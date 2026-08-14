import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { describeAuthError, loginWithPasskey, signup } from "../api/auth";
import { useSession } from "../hooks/useSession";

export default function LoginPage() {
  const { authenticated, isLoading, refresh } = useSession();
  const navigate = useNavigate();

  const [showSignup, setShowSignup] = useState(false);
  const [displayName, setDisplayName] = useState("");
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
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    setError(null);
    setBusy(true);
    try {
      await signup({ displayName: displayName || undefined });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
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

        <button className="btn-link" onClick={() => setShowSignup((v) => !v)} type="button">
          {showSignup ? "Hide sign up" : "New here? Create an account"}
        </button>

        {showSignup && (
          <div className="auth-setup">
            <label>
              Name this account (optional)
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Personal, or your name"
              />
            </label>
            <button className="btn btn-secondary" onClick={handleSignup} disabled={busy}>
              Create account with a passkey
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

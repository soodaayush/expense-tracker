import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotificationPreferencesQuery, useUpdateNotificationPreferences } from "../hooks/useNotificationPreferences";

const TIME_ZONES =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

// The only send times the notifications-worker timer is meant to be picked for — kept as
// "HH:MM" strings so this drops straight into the existing <select> value/onChange without
// needing a separate numeric representation.
const SEND_TIME_OPTIONS = [
  { value: "09:00", label: "9:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "18:00", label: "6:00 PM" },
];
const DEFAULT_SEND_TIME = SEND_TIME_OPTIONS[0].value;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function NotificationsPage() {
  const preferencesQuery = useNotificationPreferencesQuery();
  const updatePreferences = useUpdateNotificationPreferences();

  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [leadDays, setLeadDays] = useState(3);
  const [sendTime, setSendTime] = useState("09:00");
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Preferences arrive async from the query — populate the editable draft once, the first time
  // they show up, rather than on every refetch (which would stomp on in-progress edits).
  useEffect(() => {
    if (!preferencesQuery.data || loaded) return;
    const p = preferencesQuery.data;
    setEmail(p.email ?? "");
    setEnabled(p.enabled);
    setLeadDays(p.leadDays);
    // A previously-saved time from before send times were restricted to these four slots
    // (e.g. an old free-form value) won't match any <option> — fall back rather than leave the
    // select showing nothing selected. Saving is still an explicit action, so this can't
    // silently overwrite anything until the user actually hits Save.
    const savedTime = `${pad(p.sendHour)}:${pad(p.sendMinute)}`;
    setSendTime(SEND_TIME_OPTIONS.some((o) => o.value === savedTime) ? savedTime : DEFAULT_SEND_TIME);
    setTimeZone(p.timeZone);
    setLoaded(true);
  }, [preferencesQuery.data, loaded]);

  function handleSave() {
    setMessage(null);
    const [hourStr, minuteStr] = sendTime.split(":");
    const trimmedEmail = email.trim();

    if (enabled && !trimmedEmail) {
      setMessage({ text: "An email address is required to enable notifications.", error: true });
      return;
    }

    const sendMinute = Number(minuteStr);
    if (!SEND_TIME_OPTIONS.some((o) => o.value === sendTime)) {
      setMessage({ text: "Send time must be one of the available options.", error: true });
      return;
    }

    updatePreferences.mutate(
      {
        email: trimmedEmail === "" ? null : trimmedEmail,
        enabled,
        leadDays,
        sendHour: Number(hourStr),
        sendMinute,
        timeZone,
      },
      {
        onSuccess: () => setMessage({ text: "Saved.", error: false }),
        onError: (err) =>
          setMessage({ text: err instanceof Error ? err.message : "Failed to save", error: true }),
      }
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Notification Preferences</h1>
        <Link to="/" className="btn-link">
          Back to bills
        </Link>
      </header>

      {preferencesQuery.isLoading && <p>Loading…</p>}
      {preferencesQuery.isError && <p className="auth-error">Failed to load preferences.</p>}
      {message && (message.error ? <p className="auth-error">{message.text}</p> : <p className="page-message">{message.text}</p>)}

      {loaded && (
        <div className="settings-card">
          <label className="settings-checkbox-field">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Email me reminders about upcoming bills
          </label>

          <div className="settings-field">
            <label htmlFor="notif-email">Email address</label>
            <input
              id="notif-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="settings-field">
            <label htmlFor="notif-lead-days">Recurring reminder T - x (days)</label>
            <div className="settings-inline-field">
              <input
                id="notif-lead-days"
                type="number"
                min={0}
                max={90}
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
              />
              <span>days</span>
            </div>
          </div>

          <div className="settings-field">
            <label htmlFor="notif-send-time">Send time</label>
            <select id="notif-send-time" value={sendTime} onChange={(e) => setSendTime(e.target.value)}>
              {SEND_TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <label htmlFor="notif-timezone">Time zone</label>
            <select id="notif-timezone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <p className="settings-hint">
            You'll get one email per bill, sent once, {leadDays === 0 ? "on its due date" : `${leadDays} day${leadDays === 1 ? "" : "s"} before it's due`}
            {" "}— bundled into a single daily summary at your chosen time.
          </p>

          <button className="btn btn-primary" onClick={handleSave} disabled={updatePreferences.isPending}>
            {updatePreferences.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

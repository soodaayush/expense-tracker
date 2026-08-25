import { NotificationPreferences, NotificationPreferencesPatch } from "../shared/types";

// Deliberately loose — "just check if an email looks like an email," not full RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 9am is the only send hour now — no longer user-configurable in the frontend (see
// NotificationsPage.tsx's FIXED_SEND_HOUR), but this is the real enforcement point regardless,
// since the UI alone can't stop someone from posting an arbitrary sendHour straight here.
const ALLOWED_SEND_HOURS = [9];

export type PatchValidation =
  | { ok: true; patch: NotificationPreferencesPatch }
  | { ok: false; message: string };

export function validateNotificationPreferencesPatch(raw: unknown): PatchValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "body is not an object" };
  }
  const row = raw as Record<string, unknown>;
  const patch: NotificationPreferencesPatch = {};

  if ("email" in row) {
    if (row.email === null) {
      patch.email = null;
    } else {
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!EMAIL_RE.test(email)) return { ok: false, message: "email doesn't look valid" };
      patch.email = email;
    }
  }

  if ("enabled" in row) {
    if (typeof row.enabled !== "boolean") return { ok: false, message: "enabled must be a boolean" };
    patch.enabled = row.enabled;
  }

  if ("leadDays" in row) {
    const leadDays = Number(row.leadDays);
    if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 90) {
      return { ok: false, message: "leadDays must be an integer between 0 and 90" };
    }
    patch.leadDays = leadDays;
  }

  if ("sendHour" in row) {
    const sendHour = Number(row.sendHour);
    if (!ALLOWED_SEND_HOURS.includes(sendHour)) {
      return { ok: false, message: `sendHour must be one of ${ALLOWED_SEND_HOURS.join(", ")}` };
    }
    patch.sendHour = sendHour;
  }

  if ("sendMinute" in row) {
    const sendMinute = Number(row.sendMinute);
    // Restricted to exactly on-the-hour — the notifications-worker timer only checks every 60
    // minutes (matching this), so anything else would silently wait up to an hour past whatever
    // was actually requested.
    if (sendMinute !== 0) {
      return { ok: false, message: "sendMinute must be 0" };
    }
    patch.sendMinute = sendMinute;
  }

  if ("timeZone" in row) {
    if (typeof row.timeZone !== "string" || !isValidTimeZone(row.timeZone)) {
      return { ok: false, message: "timeZone is not a recognized IANA time zone" };
    }
    patch.timeZone = row.timeZone;
  }

  return { ok: true, patch };
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Cross-field rule that only makes sense once the patch is merged onto the current row —
// enabling notifications with no email to send them to is a no-op nobody would knowingly want.
export function validateMergedPreferences(prefs: NotificationPreferences): string | null {
  if (prefs.enabled && !prefs.email) return "email is required to enable notifications";
  return null;
}

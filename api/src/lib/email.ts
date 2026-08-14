import { EmailClient } from "@azure/communication-email";
import { Bill } from "../shared/types";

let client: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (!client) {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString) throw new Error("ACS_CONNECTION_STRING is not set");
    client = new EmailClient(connectionString);
  }
  return client;
}

function senderAddress(): string {
  const value = process.env.NOTIFICATION_SENDER_EMAIL;
  if (!value) throw new Error("NOTIFICATION_SENDER_EMAIL is not set");
  return value;
}

function appOrigin(): string {
  const value = process.env.ORIGIN;
  if (!value) throw new Error("ORIGIN is not set");
  return value;
}

export async function sendReminderDigest(to: string, bills: Bill[]): Promise<void> {
  const { subject, html, plainText } = buildDigestEmail(bills, appOrigin());
  const client = getEmailClient();
  const poller = await client.beginSend({
    senderAddress: senderAddress(),
    content: { subject, html, plainText },
    recipients: { to: [{ address: to }] },
  });
  await poller.pollUntilDone();
}

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const dateFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" });

// Dates are plain "YYYY-MM-DD" strings — parse the components directly rather than
// `new Date(isoString)`, which reads as UTC midnight and can print as the wrong day depending
// on server timezone (same rule the frontend's dateUtils.ts follows).
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDigestEmail(
  bills: Bill[],
  origin: string
): { subject: string; html: string; plainText: string } {
  const subject =
    bills.length === 1 ? `1 bill due soon — ${bills[0].payee}` : `${bills.length} bills due soon`;
  const intro = bills.length === 1 ? "You have a bill coming due:" : `You have ${bills.length} bills coming due:`;
  const preferencesUrl = `${origin}/notifications`;

  const rows = bills
    .map(
      (b) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#16181d;">${escapeHtml(b.payee)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;white-space:nowrap;">${formatDate(b.dueDate)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#16181d;text-align:right;font-weight:600;white-space:nowrap;">${b.amount != null ? currency.format(b.amount) : "—"}</td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 28px 4px;">
                <span style="font-size:20px;font-weight:700;color:#16181d;">💳 Bill Tracker</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 20px;">
                <p style="margin:0;font-size:15px;color:#16181d;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Payee</th>
                      <th align="left" style="padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Due</th>
                      <th align="right" style="padding:8px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <a href="${origin}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">Open Bill Tracker</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  You're getting this because reminders are turned on for your account.
                  <a href="${preferencesUrl}" style="color:#9ca3af;">Manage your notification preferences</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const plainText = [
    intro,
    "",
    ...bills.map((b) => `- ${b.payee}: ${b.amount != null ? currency.format(b.amount) : "—"} due ${formatDate(b.dueDate)}`),
    "",
    `Open Bill Tracker: ${origin}`,
    `Manage your notification preferences: ${preferencesUrl}`,
  ].join("\n");

  return { subject, html, plainText };
}

import { app, InvocationContext, Timer } from "@azure/functions";
import {
  findBillsNeedingReminder,
  listEnabledNotificationPreferences,
  markBillsReminded,
  markNotificationCheckDone,
  NotificationPreferencesRow,
} from "../lib/db";
import { sendReminderDigest } from "../lib/email";

// Local calendar date + wall-clock time for a user's IANA zone, computed fresh on every run —
// this is what makes the send time follow the user's actual local time across DST transitions
// without the schedule itself ever needing to change.
function localDateTime(timeZone: string, now: Date): { localDate: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { localDate: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

// Fires once local time has reached (not just hit exactly) the user's preferred send time and
// they haven't already been checked today — "at or past" rather than an exact-minute match
// means this reliably catches the target time at the next check regardless of how the fixed
// UTC schedule below happens to land for a given user's timezone (worst case ~15h, across the
// overnight gap between the last check of one day and the first of the next — see the timer
// schedule below), and "haven't already sent today" is what keeps it from re-firing for the
// rest of that day once it has.
function isDueForCheck(user: NotificationPreferencesRow, now: Date): { localDate: string; due: boolean } {
  const { localDate, hour, minute } = localDateTime(user.timeZone, now);
  const nowMinutes = hour * 60 + minute;
  const targetMinutes = user.sendHour * 60 + user.sendMinute;
  return { localDate, due: nowMinutes >= targetMinutes && user.lastSentLocalDate !== localDate };
}

app.timer("notificationsSend", {
  // Exactly 4 checks a day — at 12:00, 15:00, 18:00, 21:00 UTC, the equivalent of 9am/12pm/3pm/
  // 6pm Atlantic Daylight Time (UTC-3) — instead of hourly or a generic */4 grid. Fewer checks
  // means the free-tier serverless SQL database gets longer real stretches to stay auto-paused,
  // which is what actually matters for the monthly free vCore-second budget (repeated hourly
  // checks were what burned through it in days rather than lasting the month).
  //
  // This is a fixed UTC schedule, so it's anchored to *a* timezone, not *the* user's — it won't
  // perfectly track DST (Atlantic time falls back to UTC-4 for AST in winter, shifting the
  // nominal alignment here by an hour) and it won't line up with 9/12/15/18 for someone in a
  // very different timezone (e.g. 6pm Pacific lands in the ~15h overnight gap between the
  // 21:00 UTC check and the next day's 12:00 UTC one). Neither matters for correctness:
  // isDueForCheck recomputes each user's own local time fresh every run regardless of which UTC
  // moment this fires at, so nothing is ever missed or double-sent — worst case is just delay,
  // bounded by how far someone's chosen local time sits from these four fixed UTC moments.
  schedule: "0 0 12,15,18,21 * * *",
  handler: async (_myTimer: Timer, context: InvocationContext) => {
    const now = new Date();
    const users = await listEnabledNotificationPreferences();

    for (const user of users) {
      try {
        const { localDate, due } = isDueForCheck(user, now);
        if (!due) continue;

        const bills = await findBillsNeedingReminder(user.userId, user.leadDays);
        if (bills.length > 0 && user.email) {
          await sendReminderDigest(user.email, bills);
          await markBillsReminded(
            user.userId,
            bills.map((b) => b.id)
          );
        }
        await markNotificationCheckDone(user.userId, localDate);
      } catch (err) {
        // One user's failure (bad email, transient ACS error) shouldn't block everyone else's
        // reminders — log and move on rather than letting the whole run throw.
        context.error(`notificationsSend failed for user ${user.userId}`, err);
      }
    }
  },
});

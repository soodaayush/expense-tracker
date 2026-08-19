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
// means this reliably catches the target time within one check of a user's chosen time (the
// timer runs every 60 minutes — see below — and the UI/API only ever accept on-the-hour send
// times, so the two stay in lockstep with no drift), and "haven't already sent today" is what
// keeps it from re-firing for the rest of that day once it has.
function isDueForCheck(user: NotificationPreferencesRow, now: Date): { localDate: string; due: boolean } {
  const { localDate, hour, minute } = localDateTime(user.timeZone, now);
  const nowMinutes = hour * 60 + minute;
  const targetMinutes = user.sendHour * 60 + user.sendMinute;
  return { localDate, due: nowMinutes >= targetMinutes && user.lastSentLocalDate !== localDate };
}

app.timer("notificationsSend", {
  // Every 60 minutes, matching the granularity send times are actually restricted to (see
  // notificationValidation.ts) — checking any more often than the input allows would just be
  // extra executions for zero added precision. ~720/month, nothing against the Consumption
  // plan's 1,000,000 free execution grant.
  schedule: "0 0 * * * *",
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

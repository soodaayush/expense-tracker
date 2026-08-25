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
// they haven't already been checked today. With only one check a day (see the timer schedule
// below), "at or past" rather than an exact match is what makes this DST-safe: the schedule is
// deliberately anchored so the single daily check always lands at or after 9am local, so this
// condition is always eventually true that day rather than the day being silently skipped.
// "Haven't already sent today" is what keeps it from re-firing later that same day once it has.
function isDueForCheck(user: NotificationPreferencesRow, now: Date): { localDate: string; due: boolean } {
  const { localDate, hour, minute } = localDateTime(user.timeZone, now);
  const nowMinutes = hour * 60 + minute;
  const targetMinutes = user.sendHour * 60 + user.sendMinute;
  return { localDate, due: nowMinutes >= targetMinutes && user.lastSentLocalDate !== localDate };
}

app.timer("notificationsSend", {
  // Exactly once a day — 9am is now the only send-time option (see notificationValidation.ts /
  // NotificationsPage.tsx), so there's no longer a reason to check more than once. This also
  // maximizes how long the free-tier serverless SQL database gets to stay auto-paused between
  // touches, which is what actually matters for the monthly free vCore-second budget (frequent
  // checks were what burned through it in days rather than lasting the month last time).
  //
  // 13:00 UTC specifically, not 12:00 — deliberately anchored to Atlantic *Standard* Time
  // (UTC-4, winter), not Atlantic *Daylight* Time (UTC-3, summer). With only one check a day,
  // picking the summer offset would mean the single check lands at 8am local during winter
  // months — *before* 9am — and since isDueForCheck's "at or past" comparison would then be
  // false all day with no later check to catch it, that user would be silently skipped
  // entirely until the next day. Anchoring to the winter offset guarantees the check always
  // lands at or after 9am local Atlantic time year-round; the cost is arriving an hour "late"
  // (10am local) during Atlantic Daylight Time instead — late beats skipped.
  //
  // This is still a fixed UTC schedule, so it's anchored to *a* timezone, not *the* user's — for
  // someone in a very different timezone than Atlantic Canada, 13:00 UTC could land well before
  // or well after their own local 9am. That's still not a correctness problem: isDueForCheck
  // recomputes each user's own local time fresh every run, so a mistimed check just means it
  // catches them up to ~24h later than their exact local 9am, never skips them outright.
  schedule: "0 0 13 * * *",
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

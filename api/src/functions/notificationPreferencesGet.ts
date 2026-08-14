import { app } from "@azure/functions";
import { getNotificationPreferences } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("notificationPreferencesGet", {
  methods: ["GET"],
  route: "notifications/preferences",
  authLevel: "anonymous",
  handler: withAuth(async (_request, _context, session) => {
    const preferences = await getNotificationPreferences(session.userId);
    return { status: 200, jsonBody: { preferences } };
  }),
});

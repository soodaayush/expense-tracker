import { app } from "@azure/functions";
import { getNotificationPreferences, saveNotificationPreferences } from "../lib/db";
import { HttpError } from "../lib/errors";
import { validateMergedPreferences, validateNotificationPreferencesPatch } from "../lib/notificationValidation";
import { withAuth } from "../middleware/withAuth";

app.http("notificationPreferencesUpdate", {
  methods: ["PUT"],
  route: "notifications/preferences",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = await request.json().catch(() => null);
    const validation = validateNotificationPreferencesPatch(body);
    if (!validation.ok) throw new HttpError(400, validation.message);

    const current = await getNotificationPreferences(session.userId);
    const merged = { ...current, ...validation.patch };

    const crossFieldError = validateMergedPreferences(merged);
    if (crossFieldError) throw new HttpError(400, crossFieldError);

    const preferences = await saveNotificationPreferences(session.userId, merged);
    return { status: 200, jsonBody: { preferences } };
  }),
});

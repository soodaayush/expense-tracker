import { app } from "@azure/functions";
import { withCookies } from "../lib/http";
import { createChallengeCookie } from "../lib/session";
import { listCredentialsForUser } from "../lib/db";
import { buildRegistrationOptions } from "../lib/webauthn";
import { withAuth } from "../middleware/withAuth";

app.http("authDevicesOptions", {
  methods: ["POST"],
  route: "auth/devices/options",
  authLevel: "anonymous",
  handler: withAuth(async (_request, _context, session) => {
    const existing = await listCredentialsForUser(session.userId);
    const options = await buildRegistrationOptions({
      userId: session.userId,
      displayName: session.displayName,
      excludeCredentials: existing,
    });
    return withCookies({ status: 200, jsonBody: options }, [createChallengeCookie(options.challenge)]);
  }),
});

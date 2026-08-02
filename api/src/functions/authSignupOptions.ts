import { app } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { withCookies } from "../lib/http";
import { createPendingSignupCookie } from "../lib/session";
import { buildRegistrationOptions } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

interface SignupOptionsBody {
  displayName?: string;
}

app.http("authSignupOptions", {
  methods: ["POST"],
  route: "auth/signup/options",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const body = (await request.json().catch(() => ({}))) as SignupOptionsBody;
    const userId = randomUUID();

    const options = await buildRegistrationOptions({
      userId,
      displayName: body.displayName,
      excludeCredentials: [],
    });

    return withCookies({ status: 200, jsonBody: options }, [
      createPendingSignupCookie({ challenge: options.challenge, userId, displayName: body.displayName }),
    ]);
  }),
});

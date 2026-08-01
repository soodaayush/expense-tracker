import { app } from "@azure/functions";
import { withCookies } from "../lib/http";
import { createChallengeCookie } from "../lib/session";
import { buildAuthenticationOptions } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

app.http("authLoginOptions", {
  methods: ["POST"],
  route: "auth/login/options",
  authLevel: "anonymous",
  handler: withErrors(async () => {
    const options = await buildAuthenticationOptions();
    return withCookies({ status: 200, jsonBody: options }, [createChallengeCookie(options.challenge)]);
  }),
});

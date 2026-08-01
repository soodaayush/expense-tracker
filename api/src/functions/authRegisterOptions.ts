import { app, HttpRequest } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { withCookies } from "../lib/http";
import { createChallengeCookie, verifySessionCookie } from "../lib/session";
import { listCredentials } from "../lib/tables";
import { buildRegistrationOptions, isLocalDev } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

async function requireBootstrapOrSession(request: HttpRequest, existingCount: number): Promise<void> {
  if (existingCount === 0) {
    if (isLocalDev()) return;
    const body = (await request.json().catch(() => ({}))) as { setupToken?: string };
    const expected = process.env.SETUP_TOKEN;
    if (!expected || body.setupToken !== expected) {
      throw new HttpError(403, "invalid_setup_token");
    }
    return;
  }
  const session = await verifySessionCookie(request);
  if (!session) throw new HttpError(401, "unauthorized");
}

app.http("authRegisterOptions", {
  methods: ["POST"],
  route: "auth/register/options",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const existing = await listCredentials();
    await requireBootstrapOrSession(request, existing.length);

    const options = await buildRegistrationOptions(existing);
    return withCookies({ status: 200, jsonBody: options }, [createChallengeCookie(options.challenge)]);
  }),
});

import { app } from "@azure/functions";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { HttpError } from "../lib/errors";
import { withCookies } from "../lib/http";
import {
  clearChallengeCookie,
  createSessionCookie,
  readChallengeCookie,
  verifySessionCookie,
} from "../lib/session";
import { createCredential, listCredentials } from "../lib/tables";
import { isLocalDev, verifyRegistration } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

interface VerifyBody {
  setupToken?: string;
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}

app.http("authRegisterVerify", {
  methods: ["POST"],
  route: "auth/register/verify",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const body = (await request.json()) as VerifyBody;
    const existing = await listCredentials();
    const isBootstrap = existing.length === 0;

    if (isBootstrap) {
      if (!isLocalDev()) {
        const expected = process.env.SETUP_TOKEN;
        if (!expected || body.setupToken !== expected) throw new HttpError(403, "invalid_setup_token");
      }
    } else {
      const session = await verifySessionCookie(request);
      if (!session) throw new HttpError(401, "unauthorized");
    }

    const challenge = readChallengeCookie(request);
    if (!challenge) throw new HttpError(400, "missing_or_expired_challenge");

    const result = await verifyRegistration(body.response, challenge);
    if (!result.verified || !result.registrationInfo) {
      throw new HttpError(400, "registration_not_verified");
    }

    const { credential } = result.registrationInfo;
    await createCredential({
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      deviceLabel: body.deviceLabel?.trim() || "Unnamed device",
      createdAt: new Date().toISOString(),
    });

    const cookies = [clearChallengeCookie()];
    if (isBootstrap) cookies.push(createSessionCookie());

    return withCookies({ status: 200, jsonBody: { verified: true } }, cookies);
  }),
});

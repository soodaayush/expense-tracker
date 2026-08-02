import { app } from "@azure/functions";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { HttpError } from "../lib/errors";
import { readChallengeCookie, clearChallengeCookie } from "../lib/session";
import { withCookies } from "../lib/http";
import { createCredential } from "../lib/db";
import { verifyRegistration } from "../lib/webauthn";
import { withAuth } from "../middleware/withAuth";

interface DevicesVerifyBody {
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}

app.http("authDevicesVerify", {
  methods: ["POST"],
  route: "auth/devices/verify",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = (await request.json()) as DevicesVerifyBody;

    const challenge = readChallengeCookie(request);
    if (!challenge) throw new HttpError(400, "missing_or_expired_challenge");

    const result = await verifyRegistration(body.response, challenge);
    if (!result.verified || !result.registrationInfo) {
      throw new HttpError(400, "registration_not_verified");
    }

    const { credential } = result.registrationInfo;
    await createCredential({
      credentialId: credential.id,
      userId: session.userId,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      deviceLabel: body.deviceLabel?.trim() || "Unnamed device",
      createdAt: new Date().toISOString(),
    });

    return withCookies({ status: 200, jsonBody: { verified: true } }, [clearChallengeCookie()]);
  }),
});

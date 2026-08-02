import { app } from "@azure/functions";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { HttpError } from "../lib/errors";
import { withCookies } from "../lib/http";
import { clearPendingSignupCookie, createSessionCookie, readPendingSignupCookie } from "../lib/session";
import { createCredential, createUser } from "../lib/db";
import { verifyRegistration } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

interface SignupVerifyBody {
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}

app.http("authSignupVerify", {
  methods: ["POST"],
  route: "auth/signup/verify",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const body = (await request.json()) as SignupVerifyBody;

    const pending = readPendingSignupCookie(request);
    if (!pending) throw new HttpError(400, "missing_or_expired_challenge");

    const result = await verifyRegistration(body.response, pending.challenge);
    if (!result.verified || !result.registrationInfo) {
      throw new HttpError(400, "registration_not_verified");
    }

    await createUser(pending.userId, pending.displayName);

    const { credential } = result.registrationInfo;
    await createCredential({
      credentialId: credential.id,
      userId: pending.userId,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      deviceLabel: body.deviceLabel?.trim() || "Unnamed device",
      createdAt: new Date().toISOString(),
    });

    return withCookies({ status: 200, jsonBody: { verified: true } }, [
      clearPendingSignupCookie(),
      createSessionCookie(pending.userId, pending.displayName),
    ]);
  }),
});

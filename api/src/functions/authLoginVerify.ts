import { app } from "@azure/functions";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { HttpError } from "../lib/errors";
import { withCookies } from "../lib/http";
import { clearChallengeCookie, createSessionCookie, readChallengeCookie } from "../lib/session";
import { getCredential, updateCredentialCounter } from "../lib/tables";
import { verifyAuthentication } from "../lib/webauthn";
import { withErrors } from "../middleware/withAuth";

interface VerifyBody {
  response: AuthenticationResponseJSON;
}

app.http("authLoginVerify", {
  methods: ["POST"],
  route: "auth/login/verify",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const body = (await request.json()) as VerifyBody;

    const challenge = readChallengeCookie(request);
    if (!challenge) throw new HttpError(400, "missing_or_expired_challenge");

    const credential = await getCredential(body.response.id);
    if (!credential) throw new HttpError(401, "unknown_credential");

    const result = await verifyAuthentication(body.response, challenge, credential);
    if (!result.verified) throw new HttpError(401, "authentication_not_verified");

    await updateCredentialCounter(credential.credentialId, result.authenticationInfo.newCounter);

    return withCookies({ status: 200, jsonBody: { verified: true } }, [
      clearChallengeCookie(),
      createSessionCookie(),
    ]);
  }),
});

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiFetch } from "./client";

export async function fetchSession(): Promise<{ authenticated: boolean; displayName?: string }> {
  return apiFetch("/auth/session");
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function signup(opts: { displayName?: string; deviceLabel?: string }): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>("/auth/signup/options", {
    method: "POST",
    body: JSON.stringify({ displayName: opts.displayName }),
  });

  const response = await startRegistration({ optionsJSON: options });

  await apiFetch("/auth/signup/verify", {
    method: "POST",
    body: JSON.stringify({ response, deviceLabel: opts.deviceLabel }),
  });
}

// Split into two steps (unlike signup, which collects its device label from a plain <input>
// before the triggering click) so the caller can run the WebAuthn ceremony immediately after
// the click and only ask for a device label afterwards. Browsers only allow
// navigator.credentials.create()/get() within a short "transient user activation" window after
// a real click; a window.prompt() in between blocks for as long as the user takes to type,
// which can easily outlast that window and make the ceremony fail with a confusing
// NotAllowedError — nothing to do with network speed, just step order.
export async function fetchAddPasskeyOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return apiFetch("/auth/devices/options", { method: "POST" });
}

export async function createAddPasskeyCredential(
  options: PublicKeyCredentialCreationOptionsJSON
): Promise<RegistrationResponseJSON> {
  return startRegistration({ optionsJSON: options });
}

export async function verifyAddPasskey(response: RegistrationResponseJSON, deviceLabel?: string): Promise<void> {
  await apiFetch("/auth/devices/verify", {
    method: "POST",
    body: JSON.stringify({ response, deviceLabel }),
  });
}

export async function loginWithPasskey(): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialRequestOptionsJSON>("/auth/login/options", {
    method: "POST",
  });

  const response = await startAuthentication({ optionsJSON: options });

  await apiFetch("/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

// WebAuthn's NotAllowedError is heavily overloaded by browsers/platforms — genuine user
// cancellation, but also a missing/expired activation window (see fetchAddPasskeyOptions above)
// — so give it a clearer, actionable message instead of surfacing the raw platform text.
export function describeAuthError(err: unknown): string {
  if (err instanceof Error && err.name === "NotAllowedError") {
    return "The passkey prompt was interrupted or timed out — please try again.";
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

type PublicKeyCredentialCreationOptionsJSON = Parameters<typeof startRegistration>[0]["optionsJSON"];
type PublicKeyCredentialRequestOptionsJSON = Parameters<typeof startAuthentication>[0]["optionsJSON"];
type RegistrationResponseJSON = Awaited<ReturnType<typeof startRegistration>>;

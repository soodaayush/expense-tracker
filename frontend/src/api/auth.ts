import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiFetch } from "./client";

export async function fetchSession(): Promise<{ authenticated: boolean }> {
  return apiFetch("/auth/session");
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function registerPasskey(opts: { setupToken?: string; deviceLabel?: string }): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>("/auth/register/options", {
    method: "POST",
    body: JSON.stringify({ setupToken: opts.setupToken }),
  });

  const response = await startRegistration({ optionsJSON: options });

  await apiFetch("/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ setupToken: opts.setupToken, response, deviceLabel: opts.deviceLabel }),
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

type PublicKeyCredentialCreationOptionsJSON = Parameters<typeof startRegistration>[0]["optionsJSON"];
type PublicKeyCredentialRequestOptionsJSON = Parameters<typeof startAuthentication>[0]["optionsJSON"];

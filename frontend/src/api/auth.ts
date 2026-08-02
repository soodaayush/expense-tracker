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

export async function addPasskey(opts: { deviceLabel?: string }): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>("/auth/devices/options", {
    method: "POST",
  });

  const response = await startRegistration({ optionsJSON: options });

  await apiFetch("/auth/devices/verify", {
    method: "POST",
    body: JSON.stringify({ response, deviceLabel: opts.deviceLabel }),
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

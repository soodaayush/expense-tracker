import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { CredentialRecord } from "./db";

export const RP_NAME = "Bill Tracker";

export function rpID(): string {
  const value = process.env.RP_ID;
  if (!value) throw new Error("RP_ID is not set");
  return value;
}

export function origin(): string {
  const value = process.env.ORIGIN;
  if (!value) throw new Error("ORIGIN is not set");
  return value;
}

export async function buildRegistrationOptions(opts: {
  userId: string;
  displayName?: string;
  excludeCredentials: CredentialRecord[];
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const name = opts.displayName?.trim() || "Bill Tracker account";
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userID: new TextEncoder().encode(opts.userId),
    userName: name,
    userDisplayName: name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
    excludeCredentials: opts.excludeCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
    })),
  });
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
  });
}

export async function buildAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: CredentialRecord
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
    },
  });
}

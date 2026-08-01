import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpRequest } from "@azure/functions";

const SESSION_COOKIE = "session";
const CHALLENGE_COOKIE = "pending_challenge";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CHALLENGE_MAX_AGE_SECONDS = 60 * 5; // 5 minutes

export interface SessionPayload {
  iat: number;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function pack(value: string): string {
  const sig = sign(value);
  return `${Buffer.from(value, "utf8").toString("base64url")}.${sig}`;
}

function unpack(token: string): string | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const value = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = sign(value);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

function readCookie(request: HttpRequest, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function cookieHeader(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.ORIGIN?.startsWith("https://") ? "; Secure" : "";
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function createSessionCookie(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { iat: now, exp: now + SESSION_MAX_AGE_SECONDS };
  return cookieHeader(SESSION_COOKIE, pack(JSON.stringify(payload)), SESSION_MAX_AGE_SECONDS);
}

export function clearSessionCookie(): string {
  return cookieHeader(SESSION_COOKIE, "", 0);
}

export async function verifySessionCookie(request: HttpRequest): Promise<SessionPayload | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const raw = unpack(token);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createChallengeCookie(challenge: string): string {
  return cookieHeader(CHALLENGE_COOKIE, pack(challenge), CHALLENGE_MAX_AGE_SECONDS);
}

export function clearChallengeCookie(): string {
  return cookieHeader(CHALLENGE_COOKIE, "", 0);
}

export function readChallengeCookie(request: HttpRequest): string | null {
  const token = readCookie(request, CHALLENGE_COOKIE);
  if (!token) return null;
  return unpack(token);
}

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_token";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CLOCK_SKEW_MS = 60 * 1000; // 1 minute

function getSecret(): string | null {
  const pin = process.env.ADMIN_PIN;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!pin || !password) return null;

  return `${pin}:${password}`;
}

function sign(timestamp: number): string | null {
  const secret = getSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(String(timestamp))
    .digest("hex");
}

export function createAdminToken(): string | null {
  const ts = Date.now();
  const sig = sign(ts);
  if (!sig) return null;
  return `${ts}.${sig}`;
}

function isValidToken(token: string): boolean {
  const [tsStr, sig] = token.split(".");
  const ts = Number(tsStr);
  if (!ts || !sig) return false;

  const now = Date.now();
  if (ts > now + MAX_CLOCK_SKEW_MS) return false;
  if (now - ts > TOKEN_TTL_MS) return false;

  const expected = sign(ts);
  if (!expected) return false;

  if (sig.length % 2 !== 0) return false;
  if (!/^[0-9a-f]+$/i.test(sig)) return false;

  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
  });
}

export function verifyAdminRequest(request: NextRequest): boolean {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie && isValidToken(cookie.value)) return true;

  const header = request.headers.get("x-admin-token");
  if (header && isValidToken(header)) return true;

  return false;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

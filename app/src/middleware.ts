import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "auth_token";

let cachedToken: string | null = null;

async function generateToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    throw new Error("BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set");
  }

  const secret = `${user}:${password}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("authenticated")
  );
  cachedToken = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return cachedToken;
}

export async function middleware(request: NextRequest) {
  if (!process.env.BASIC_AUTH_USER || !process.env.BASIC_AUTH_PASSWORD) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE);
  if (cookie && cookie.value === (await generateToken())) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        const decoded = atob(encoded);
        const colonIndex = decoded.indexOf(":");
        if (colonIndex === -1) throw new Error("invalid");
        const user = decoded.slice(0, colonIndex);
        const password = decoded.slice(colonIndex + 1);
        if (
          user === process.env.BASIC_AUTH_USER &&
          password === process.env.BASIC_AUTH_PASSWORD
        ) {
          const response = NextResponse.next();
          response.cookies.set(AUTH_COOKIE, await generateToken(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 24, // 1 day
          });
          return response;
        }
      } catch {
        // Malformed Base64; fall through to 401
      }
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|bell.png).*)",
  ],
};

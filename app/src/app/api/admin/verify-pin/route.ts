import { NextRequest, NextResponse } from "next/server";
import {
  createAdminToken,
  setAdminCookie,
} from "@/lib/infrastructure/auth/admin-token";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const attempts = new Map<string, { count: number; firstAt: number }>();

function getIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]!.trim() : "unknown";
}

function isRateLimited(ip: string): boolean {
  const info = attempts.get(ip);
  if (!info) return false;
  if (Date.now() - info.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return info.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const info = attempts.get(ip);
  if (!info || now - info.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
  } else {
    info.count++;
  }
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json({ valid: false }, { status: 429 });
  }

  const { pin } = await request.json();

  if (pin === process.env.ADMIN_PIN) {
    const token = createAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    const response = NextResponse.json({ valid: true });
    setAdminCookie(response, token);
    attempts.delete(ip);
    return response;
  }

  recordFailure(ip);
  return NextResponse.json({ valid: false }, { status: 401 });
}

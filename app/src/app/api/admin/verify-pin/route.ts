import { NextRequest, NextResponse } from "next/server";
import {
  createAdminToken,
  setAdminCookie,
} from "@/lib/infrastructure/auth/admin-token";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (pin === process.env.ADMIN_PIN) {
    const token = createAdminToken();
    const response = NextResponse.json({ valid: true });
    setAdminCookie(response, token);
    return response;
  }

  return NextResponse.json({ valid: false }, { status: 401 });
}

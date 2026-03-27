import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/infrastructure/auth/admin-token";

export async function GET(request: NextRequest) {
  if (verifyAdminRequest(request)) {
    return NextResponse.json({ valid: true });
  }
  return NextResponse.json({ valid: false }, { status: 401 });
}

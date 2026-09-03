import { NextResponse } from "next/server";
import { OPS_COOKIE, opsCookieOptions } from "@/lib/ops/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, "", { ...opsCookieOptions(), maxAge: 0 });
  return res;
}

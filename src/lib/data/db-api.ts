import { NextResponse } from "next/server";
import { pgErrorCode } from "@/lib/data/pg";

function safeDbMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]")
    .replace(/password[=:]\S+/gi, "password=[redacted]")
    .slice(0, 300);
}

export function dbUnavailableResponse(err: unknown, event: string): NextResponse {
  console.error(
    JSON.stringify({ event, message: safeDbMessage(err), code: pgErrorCode(err) }),
  );
  return NextResponse.json(
    { error: "Base de dados indisponível. Tente de novo em instantes." },
    { status: 503 },
  );
}


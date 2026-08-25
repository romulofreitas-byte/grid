import { NextResponse } from "next/server";
import { usesMockAuth } from "@/lib/auth/mock";
import { getDataSource, hasLiveDatabase } from "@/lib/data";
import { isRuntimeProduction } from "@/lib/env/deploy";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isRuntimeProduction()) {
    return NextResponse.json({ demoMode: false });
  }
  const dataSource = getDataSource();
  return NextResponse.json({
    dataSource,
    liveDatabase: hasLiveDatabase(),
    mockAuth: usesMockAuth(),
    demoMode: dataSource === "mock",
  });
}

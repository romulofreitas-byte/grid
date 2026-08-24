import { NextResponse } from "next/server";
import { usesMockAuth } from "@/lib/auth/mock";
import { getDataSource, hasLiveDatabase } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const dataSource = getDataSource();
  return NextResponse.json({
    dataSource,
    liveDatabase: hasLiveDatabase(),
    mockAuth: usesMockAuth(),
    demoMode: dataSource === "mock",
  });
}

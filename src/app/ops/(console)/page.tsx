import { Suspense } from "react";
import { OpsDashboard } from "@/app/ops/_components/OpsDashboard";

export default function OpsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-podium-muted">Carregando…</p>}
    >
      <OpsDashboard />
    </Suspense>
  );
}

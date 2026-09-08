"use client";

import dynamic from "next/dynamic";

const IntegracaoSetup = dynamic(
  () =>
    import("@/components/integracoes/IntegracaoSetup").then(
      (mod) => mod.IntegracaoSetup,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 h-48 animate-pulse rounded-lg bg-white/[0.06]" />
    ),
  },
);

export function TelefoniaSetup({ kind }: { kind: "voip" | "dialer" }) {
  return <IntegracaoSetup key={kind} kind={kind} />;
}


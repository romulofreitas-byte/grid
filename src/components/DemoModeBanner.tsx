"use client";

import { useQuery } from "@tanstack/react-query";

type MetaResponse = {
  demoMode: boolean;
  mockAuth: boolean;
  dataSource: string;
};

export function DemoModeBanner() {
  const meta = useQuery({
    queryKey: ["grid-meta"],
    queryFn: async () => {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error("meta");
      return (await res.json()) as MetaResponse;
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (!meta.data?.demoMode) return null;

  return (
    <div
      role="status"
      className="border-b border-podium-yellow/30 bg-podium-yellow/10 px-4 py-2 text-center text-xs font-medium text-podium-yellow"
    >
      Dados de demonstração — RF sintético (mock). Contagens, selos e CRM não
      refletem a Receita Federal.
      {meta.data.mockAuth ? " Auth mock ativo." : null}
    </div>
  );
}

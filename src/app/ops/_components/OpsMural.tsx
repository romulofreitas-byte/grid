"use client";

import { useQuery } from "@tanstack/react-query";
import { PilotAvatar } from "@/components/PilotAvatar";
import { formatInt, planLabel } from "@/app/ops/_components/format";
import type { OpsUserListPage } from "@/lib/ops/types";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OpsMural() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["ops-mural"],
    queryFn: async () => {
      const res = await fetch("/api/ops/users?sort=calls&limit=12&range=7d");
      if (res.status === 401) {
        throw Object.assign(new Error("auth"), { code: "auth" });
      }
      if (!res.ok) throw new Error("Falha ao carregar o mural");
      return (await res.json()) as OpsUserListPage;
    },
  });

  useEffect(() => {
    if (
      query.error &&
      query.error instanceof Error &&
      "code" in query.error &&
      query.error.code === "auth"
    ) {
      router.replace("/ops/entrar");
    }
  }, [query.error, router]);

  const ranked = [...(query.data?.users ?? [])]
    .filter((user) => user.callsInPeriod > 0)
    .sort((a, b) => b.callsInPeriod - a.callsInPeriod)
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-podium-yellow">
          Mural da semana
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          Quem ligou
        </h1>
        <p className="mt-2 max-w-xl text-sm text-podium-muted">
          Ranking interno dos últimos 7 dias, com foto. Projetar na TV da
          operação.
        </p>
      </div>
      {query.isLoading ? (
        <p className="text-sm text-podium-muted">Carregando mural…</p>
      ) : ranked.length === 0 ? (
        <p className="text-sm text-podium-muted">Ninguém ligou nesta semana.</p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((user, index) => (
            <li
              key={user.id}
              className="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-white/[0.04] p-4"
            >
              <span className="text-lg font-extrabold text-podium-yellow">
                {index + 1}
              </span>
              <PilotAvatar
                profile={{
                  foto_url: user.fotoUrl,
                  como_chama: user.nome,
                  nome: user.nome,
                }}
                size="md"
                shape="squircle"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">
                  {user.nome || "Sem nome"}
                </p>
                <p className="text-sm text-podium-muted">
                  {formatInt(user.callsInPeriod)} ligações · {planLabel(user.plan)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

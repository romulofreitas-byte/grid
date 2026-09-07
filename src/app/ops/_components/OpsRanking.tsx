"use client";

import { PilotAvatar } from "@/components/PilotAvatar";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import {
  formatInt,
  planLabel,
} from "@/app/ops/_components/format";
import type { OpsUserListItem } from "@/lib/ops/types";
import Link from "next/link";

export function OpsRanking({
  users,
  loading,
}: {
  users: OpsUserListItem[];
  loading: boolean;
}) {
  const ranked = [...users]
    .filter((user) => user.callsInPeriod > 0 || user.enrichInPeriod > 0 || user.crmWonPeriod > 0)
    .sort(
      (a, b) =>
        b.callsInPeriod - a.callsInPeriod ||
        b.crmWonPeriod - a.crmWonPeriod ||
        b.enrichInPeriod - a.enrichInPeriod,
    )
    .slice(0, 25);

  return (
    <div>
      <SectionTitle>Ranking da semana</SectionTitle>
      <Hint className="mt-1">
        Quem ligou, qualificou e fechou no recorte. Foto do piloto — use no
        mural interno. O time ainda não vê isto no app.
      </Hint>
      <div className="mt-4 space-y-2">
        {ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-podium-muted">
            {loading ? "Carregando…" : "Ninguém ligou ou fechou neste recorte."}
          </p>
        ) : (
          ranked.map((user, index) => (
            <GlassCard key={user.id} className="p-3" hover={false}>
              <Link
                href={`/ops/usuarios/${user.id}`}
                className="flex items-center gap-3"
              >
                <span className="w-6 text-center text-sm font-bold text-podium-yellow">
                  {index + 1}
                </span>
                <PilotAvatar
                  profile={{
                    foto_url: user.fotoUrl,
                    como_chama: user.nome,
                    nome: user.nome,
                  }}
                  size="sm"
                  shape="squircle"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-podium-white">
                    {user.nome || "Sem nome"}
                  </p>
                  <p className="truncate text-xs text-podium-muted">
                    {planLabel(user.plan)}
                    {user.empresa ? ` · ${user.empresa}` : ""}
                  </p>
                </div>
                <dl className="hidden gap-4 text-right text-xs sm:grid sm:grid-cols-3">
                  <div>
                    <dt className="text-podium-muted">Ligações</dt>
                    <dd className="font-semibold">{formatInt(user.callsInPeriod)}</dd>
                  </div>
                  <div>
                    <dt className="text-podium-muted">Qualif.</dt>
                    <dd className="font-semibold">{formatInt(user.enrichInPeriod)}</dd>
                  </div>
                  <div>
                    <dt className="text-podium-muted">Ganhos</dt>
                    <dd className="font-semibold">{formatInt(user.crmWonPeriod)}</dd>
                  </div>
                </dl>
              </Link>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import {
  cohortLabel,
  formatBrl,
  formatDay,
  formatInt,
  planLabel,
} from "@/app/ops/_components/format";
import type { OpsMetrics, OpsUserListItem } from "@/lib/ops/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (res.status === 401) {
    throw Object.assign(new Error("auth"), { code: "auth" });
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Falha ao carregar");
  }
  return data;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <GlassCard className="p-4" hover={false}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint ? <Hint className="mt-1">{hint}</Hint> : null}
    </GlassCard>
  );
}

export function OpsDashboard() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const metricsQuery = useQuery({
    queryKey: ["ops-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/ops/metrics");
      return readJson<OpsMetrics>(res);
    },
  });

  const usersQuery = useQuery({
    queryKey: ["ops-users", debounced],
    queryFn: async () => {
      const url = debounced
        ? `/api/ops/users?q=${encodeURIComponent(debounced)}`
        : "/api/ops/users";
      const res = await fetch(url);
      return readJson<{ users: OpsUserListItem[] }>(res);
    },
  });

  useEffect(() => {
    const err = metricsQuery.error ?? usersQuery.error;
    if (err && err instanceof Error && "code" in err && err.code === "auth") {
      router.replace("/ops/entrar");
    }
  }, [metricsQuery.error, usersQuery.error, router]);

  const m = metricsQuery.data;
  const users = usersQuery.data?.users ?? [];
  const error =
    metricsQuery.error instanceof Error
      ? metricsQuery.error.message
      : usersQuery.error instanceof Error
        ? usersQuery.error.message
        : null;

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Uso e faturamento</SectionTitle>
        <Hint className="mt-1">
          Ativo = assinatura paga vigente. Trial = Membro da Plataforma. Ativado =
          concluiu o setup.
        </Hint>
      </div>

      {error && error !== "auth" ? (
        <p className="text-sm text-podium-alert">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Usuários" value={m ? formatInt(m.users) : "—"} />
        <Kpi label="Ativos" value={m ? formatInt(m.active) : "—"} />
        <Kpi label="Trial" value={m ? formatInt(m.trial) : "—"} />
        <Kpi label="Treino livre" value={m ? formatInt(m.free) : "—"} />
        <Kpi label="Ativados" value={m ? formatInt(m.activated) : "—"} />
        <Kpi
          label="Faturado"
          value={m ? formatBrl(m.revenue.totalCents) : "—"}
          hint={
            m
              ? `${formatBrl(m.revenue.monthCents)} neste mês · ${formatBrl(m.revenue.last30dCents)} em 30d`
              : undefined
          }
        />
        <Kpi
          label="MRR"
          value={m ? formatBrl(m.mrrCents) : "—"}
          hint="Ativos × preço do catálogo"
        />
        <Kpi
          label="Créditos"
          value={m ? formatInt(m.credits.remaining) : "—"}
          hint={m ? `${formatInt(m.credits.spent)} queimados` : undefined}
        />
      </div>

      {m ? (
        <div className="grid gap-3 md:grid-cols-2">
          <GlassCard className="p-4" hover={false}>
            <p className="text-sm font-bold">Por plano</p>
            <ul className="mt-3 space-y-1.5 text-sm text-podium-gray">
              {Object.entries(m.byPlan).length === 0 ? (
                <li className="text-podium-muted">Ninguém ainda.</li>
              ) : (
                Object.entries(m.byPlan)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sku, count]) => (
                    <li key={sku} className="flex justify-between gap-3">
                      <span>{planLabel(sku)}</span>
                      <span className="font-semibold text-podium-white">
                        {formatInt(count)}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </GlassCard>
          <GlassCard className="p-4" hover={false}>
            <p className="text-sm font-bold">Uso (7 dias / total)</p>
            <ul className="mt-3 space-y-1.5 text-sm text-podium-gray">
              <li className="flex justify-between gap-3">
                <span>Buscas</span>
                <span>
                  {formatInt(m.usage.searches7d)} / {formatInt(m.usage.searchesTotal)}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Qualificações</span>
                <span>
                  {formatInt(m.usage.enrich7d)} / {formatInt(m.usage.enrichTotal)}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Ligações</span>
                <span>
                  {formatInt(m.usage.calls7d)} / {formatInt(m.usage.callsTotal)}
                </span>
              </li>
            </ul>
          </GlassCard>
        </div>
      ) : null}

      <div>
        <SectionTitle>Usuários</SectionTitle>
        <input
          className={`mt-3 ${fieldClass}`}
          placeholder="Buscar por e-mail, nome ou empresa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-podium-muted">
              <tr>
                <th className="px-3 py-2 font-bold">Piloto</th>
                <th className="px-3 py-2 font-bold">Plano</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold">Créditos</th>
                <th className="px-3 py-2 font-bold">Ativado</th>
                <th className="px-3 py-2 font-bold">LTV</th>
                <th className="px-3 py-2 font-bold">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-podium-muted"
                  >
                    {usersQuery.isLoading ? "Carregando…" : "Nenhum usuário."}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-white/[0.06]">
                    <td className="px-3 py-2">
                      <Link
                        href={`/ops/usuarios/${u.id}`}
                        className="font-semibold text-podium-white hover:text-podium-yellow"
                      >
                        {u.nome || "Sem nome"}
                      </Link>
                      <p className="text-xs text-podium-muted">
                        {u.email || "sem e-mail"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-podium-gray">
                      {planLabel(u.plan)}
                    </td>
                    <td className="px-3 py-2 text-podium-gray">
                      {cohortLabel(u.cohort)}
                      {u.cancelAtPeriodEnd ? (
                        <span className="ml-1 text-xs text-podium-alert">
                          cancela
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{formatInt(u.credits)}</td>
                    <td className="px-3 py-2">
                      {u.activated ? "Sim" : "Não"}
                    </td>
                    <td className="px-3 py-2">{formatBrl(u.ltvCents)}</td>
                    <td className="px-3 py-2 text-podium-gray">
                      {formatDay(u.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  cohortLabel,
  formatBrl,
  formatDay,
  formatInt,
  planLabel,
} from "@/app/ops/_components/format";
import { OPS_USERS_PAGE_SIZE } from "@/lib/ops/filters";
import type { OpsUserListItem } from "@/lib/ops/types";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/SectionTitle";
import Link from "next/link";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export function OpsUsersTable({
  users,
  total,
  q,
  onQ,
  offset,
  onOffset,
  loading,
}: {
  users: OpsUserListItem[];
  total: number;
  q: string;
  onQ: (value: string) => void;
  offset: number;
  onOffset: (value: number) => void;
  loading: boolean;
}) {
  const page = Math.floor(offset / OPS_USERS_PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / OPS_USERS_PAGE_SIZE));
  return (
    <div>
      <SectionTitle>Usuários</SectionTitle>
      <input
        className={`mt-3 ${fieldClass}`}
        placeholder="Buscar por e-mail, nome ou empresa"
        value={q}
        onChange={(e) => onQ(e.target.value)}
      />
      <p className="mt-2 text-xs text-podium-muted">
        {formatInt(total)} no recorte
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-podium-muted">
            <tr>
              <th className="px-3 py-2 font-bold">Piloto</th>
              <th className="px-3 py-2 font-bold">Plano</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Créditos</th>
              <th className="px-3 py-2 font-bold">Qualif.</th>
              <th className="px-3 py-2 font-bold">Recarga</th>
              <th className="px-3 py-2 font-bold">Ativado</th>
              <th className="px-3 py-2 font-bold">LTV</th>
              <th className="px-3 py-2 font-bold">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-podium-muted"
                >
                  {loading ? "Carregando…" : "Nenhum usuário."}
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
                  <td className="px-3 py-2">{formatInt(u.enrichInPeriod)}</td>
                  <td className="px-3 py-2">
                    {u.recharged ? "Sim" : "Não"}
                  </td>
                  <td className="px-3 py-2">{u.activated ? "Sim" : "Não"}</td>
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
      {total > OPS_USERS_PAGE_SIZE ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            size="sm"
            disabled={offset <= 0}
            onClick={() => onOffset(Math.max(0, offset - OPS_USERS_PAGE_SIZE))}
          >
            Anterior
          </Button>
          <p className="text-xs text-podium-muted">
            Página {formatInt(page)} de {formatInt(pages)}
          </p>
          <Button
            size="sm"
            disabled={offset + OPS_USERS_PAGE_SIZE >= total}
            onClick={() => onOffset(offset + OPS_USERS_PAGE_SIZE)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}

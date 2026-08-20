"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmptyValue } from "@/components/EmptyValue";
import { GlassCard } from "@/components/GlassCard";
import { PositionBadge } from "@/components/PositionBadge";
import {
  formatCapital,
  formatCnpj,
  formatDateBr,
  formatPorte,
} from "@/lib/format";
import type { Company, Establishment, LeadDossier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadCompanyCard({
  title,
  razaoSocial,
  showRazao,
  cityLine,
  cnaeDescricao,
  cnpj,
  gridPosition,
  gridScore,
  company,
  establishment,
  municipioNome,
  addressSharedCount,
  emailSeal,
}: {
  title: string;
  razaoSocial: string;
  showRazao: boolean;
  cityLine: string;
  cnaeDescricao: string;
  cnpj: string;
  gridPosition?: number | null;
  gridScore?: number;
  company?: Company;
  establishment?: Establishment;
  municipioNome?: string;
  addressSharedCount?: number;
  emailSeal?: LeadDossier["emailSeal"];
}) {
  const [showCadastro, setShowCadastro] = useState(false);
  const opened = establishment ? formatDateBr(establishment.data_inicio) : null;
  const canOpenCadastro = company && establishment;

  return (
    <GlassCard className="p-4 hover:translate-y-0">
      <div className="flex items-start gap-3">
        {gridPosition != null && gridScore != null ? (
          <PositionBadge position={gridPosition} score={gridScore} />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-base font-extrabold leading-tight">{title}</h1>
          {showRazao ? (
            <p className="mt-0.5 truncate text-xs text-podium-muted">{razaoSocial}</p>
          ) : null}
          <p className="mt-1 text-sm text-podium-gray">
            {cityLine || <EmptyValue />}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-podium-muted">
            {cnaeDescricao}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-podium-muted">
            {formatCnpj(cnpj)}
          </p>
        </div>
      </div>

      {canOpenCadastro ? (
        <>
          <button
            type="button"
            onClick={() => setShowCadastro((v) => !v)}
            aria-expanded={showCadastro}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-left hover:border-white/20"
          >
            <span className="text-xs font-bold">Cadastro da Receita</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-podium-muted transition",
                showCadastro && "rotate-180",
              )}
            />
          </button>
          {showCadastro ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-podium-muted">Porte</dt>
                <dd>{formatPorte(company.porte)}</dd>
              </div>
              <div>
                <dt className="text-xs text-podium-muted">Abertura</dt>
                <dd>{opened ?? <EmptyValue />}</dd>
              </div>
              <div>
                <dt className="text-xs text-podium-muted">Capital social</dt>
                <dd>{formatCapital(company.capital_social)}</dd>
              </div>
              <div>
                <dt className="text-xs text-podium-muted">CNPJ</dt>
                <dd className="font-medium">{formatCnpj(cnpj)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-podium-muted">Endereço</dt>
                <dd>
                  {[
                    establishment.logradouro,
                    establishment.numero,
                    establishment.bairro,
                    municipioNome,
                    establishment.uf,
                    establishment.cep,
                  ]
                    .filter(Boolean)
                    .join(", ") || <EmptyValue />}
                  {addressSharedCount != null && addressSharedCount >= 5 ? (
                    <span className="mt-1 block text-xs text-amber-400">
                      endereço aparece em {addressSharedCount} empresas
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-podium-muted">E-mail</dt>
                <dd>
                  {emailSeal?.email ? (
                    <>
                      <a
                        href={`mailto:${emailSeal.email}`}
                        className="text-podium-yellow"
                      >
                        {emailSeal.email}
                      </a>
                      {(emailSeal.shared ||
                        emailSeal.free ||
                        emailSeal.accountantHint) && (
                        <span className="mt-1 block text-xs text-amber-400">
                          {emailSeal.shared && "e-mail compartilhado · "}
                          {emailSeal.free && "provedor gratuito · "}
                          {emailSeal.accountantHint &&
                            "domínio com assinatura contábil"}
                        </span>
                      )}
                    </>
                  ) : (
                    <EmptyValue />
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}
    </GlassCard>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyValue } from "@/components/EmptyValue";
import { GlassCard } from "@/components/GlassCard";
import { PositionBadge } from "@/components/PositionBadge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import {
  formatCapital,
  formatCnpj,
  formatDateBr,
  formatPorte,
} from "@/lib/format";
import { estimateRevenueBand } from "@/lib/market/revenue-band";
import type { Company, Establishment, LeadDossier } from "@/lib/types";
import { cn } from "@/lib/utils";

function EmailSealNotice({
  emailSeal,
}: {
  emailSeal: NonNullable<LeadDossier["emailSeal"]>;
}) {
  const notices: Array<{ title: string; body: string }> = [];

  if (emailSeal.shared && emailSeal.accountantHint) {
    notices.push({
      title: COPY.emailSharedAccountantTitle,
      body: COPY.emailSharedAccountantBody,
    });
  } else {
    if (emailSeal.shared) {
      notices.push({
        title: COPY.emailSharedTitle,
        body: COPY.emailSharedBody,
      });
    }
    if (emailSeal.accountantHint) {
      notices.push({
        title: COPY.emailAccountantTitle,
        body: COPY.emailAccountantBody,
      });
    }
  }
  if (emailSeal.free) {
    notices.push({
      title: COPY.emailFreeTitle,
      body: COPY.emailFreeBody,
    });
  }

  if (notices.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {notices.map((n) => (
        <div
          key={n.title}
          className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-2.5 py-2"
        >
          <p className="text-[11px] font-semibold text-amber-200">{n.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-200/80">
            {n.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export type LeadCompanyCrmAction =
  | { type: "open"; href: string }
  | {
      type: "cta";
      label: string;
      pendingLabel: string;
      pending?: boolean;
      title?: string;
      onClick: () => void;
    }
  | { type: "status"; label: string };

function CompanyCrmHeaderAction({ action }: { action: LeadCompanyCrmAction }) {
  if (action.type === "open") {
    return (
      <Link
        href={action.href}
        className={buttonClassName({
          variant: "accent",
          size: "sm",
          className: "shrink-0",
        })}
      >
        {COPY.crmOpenDeal}
      </Link>
    );
  }
  if (action.type === "status") {
    return (
      <p className="max-w-[9.5rem] shrink-0 text-right text-[11px] leading-snug text-podium-muted">
        {action.label}
      </p>
    );
  }
  return (
    <Button
      size="sm"
      variant="primary"
      disabled={action.pending}
      title={action.title}
      onClick={action.onClick}
      className="shrink-0"
    >
      {action.pending ? action.pendingLabel : action.label}
    </Button>
  );
}

export function LeadCompanyCard({
  title,
  razaoSocial,
  showRazao,
  cityLine,
  cnaeDescricao,
  cnpj,
  gridPosition,
  gridScore,
  hasAudit = true,
  company,
  establishment,
  municipioNome,
  addressSharedCount,
  emailSeal,
  crmAction,
}: {
  title: string;
  razaoSocial: string;
  showRazao: boolean;
  cityLine: string;
  cnaeDescricao: string;
  cnpj: string;
  gridPosition?: number | null;
  gridScore?: number;
  hasAudit?: boolean;
  company?: Company;
  establishment?: Establishment;
  municipioNome?: string;
  addressSharedCount?: number;
  emailSeal?: LeadDossier["emailSeal"];
  crmAction?: LeadCompanyCrmAction;
}) {
  const [showCadastro, setShowCadastro] = useState(false);
  const opened = establishment ? formatDateBr(establishment.data_inicio) : null;
  const revenue = company
    ? estimateRevenueBand({
        porte: company.porte,
        capitalSocial: company.capital_social,
      })
    : null;

  return (
    <GlassCard className="border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      <div className="flex items-start gap-3">
        {gridPosition != null && gridScore != null ? (
          <PositionBadge
            position={gridPosition}
            score={gridScore}
            hasAudit={hasAudit}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold leading-tight text-podium-white">
            {title}
          </h1>
          {showRazao ? (
            <p className="mt-0.5 truncate text-xs text-podium-muted">
              {razaoSocial}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-podium-gray">
            {cityLine || <EmptyValue />}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-podium-muted">
            {cnaeDescricao}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-podium-muted">
            {formatCnpj(cnpj)}
          </p>
        </div>
        {crmAction ? <CompanyCrmHeaderAction action={crmAction} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {company?.porte ? (
          <Badge variant="neutral">{formatPorte(company.porte)}</Badge>
        ) : null}
        {revenue ? (
          <Badge
            variant="accent"
            title={`${revenue.regimeHint}. ${revenue.basis}`}
          >
            {revenue.label}
            <span className="ml-1 opacity-70">· est.</span>
          </Badge>
        ) : null}
        {establishment?.is_matriz != null ? (
          <Badge variant="neutral">
            {establishment.is_matriz ? "Matriz" : "Filial"}
          </Badge>
        ) : null}
      </div>

      {revenue ? (
        <p className="mt-2 text-[11px] leading-snug text-podium-muted">
          {revenue.regimeHint}. Confiança {revenue.confidence}. {revenue.basis}
        </p>
      ) : null}

      <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
          E-mail
        </p>
        {emailSeal?.email ? (
          <>
            <a
              href={`mailto:${emailSeal.email}`}
              className="mt-1 block truncate text-sm font-medium text-podium-white hover:text-podium-yellow"
            >
              {emailSeal.email}
            </a>
            <EmailSealNotice emailSeal={emailSeal} />
          </>
        ) : (
          <p className="mt-1 text-sm text-podium-muted">
            <EmptyValue />
          </p>
        )}
      </div>

      {company && establishment ? (
        <>
          <button
            type="button"
            onClick={() => setShowCadastro((v) => !v)}
            aria-expanded={showCadastro}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-1.5 text-left text-podium-muted hover:border-white/20 hover:text-podium-gray"
          >
            <span className="text-xs font-medium">Cadastro da Receita</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition",
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
            </dl>
          ) : null}
        </>
      ) : null}
    </GlassCard>
  );
}

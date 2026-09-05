"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CargoFields } from "@/components/CargoFields";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { MarketFields } from "@/components/MarketFields";
import { PhotoPicker } from "@/components/PhotoPicker";
import { formatDocumento, parseDocumento } from "@/lib/billing/document";
import { COPY } from "@/lib/copy";
import {
  ACCOUNT_PROFILE_QUERY_KEY,
  useAccountProfile,
} from "@/hooks/useAccountProfile";
import { CONTA_FIELD_CLASS, type AccountProfile } from "@/lib/conta";
import type { Profile } from "@/lib/types";

export default function ContaPerfilPage() {
  const qc = useQueryClient();
  const profileQuery = useAccountProfile();
  const p = profileQuery.data;
  const [docError, setDocError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (body: Partial<Profile>) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      return (await res.json()) as AccountProfile;
    },
    onSuccess: (next) =>
      qc.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, (prev: AccountProfile | undefined) =>
        prev ? { ...prev, ...next } : next,
      ),
  });

  if (!p) {
    return <div className="min-h-40 animate-pulse rounded-2xl bg-white/5" />;
  }

  const documentoDisplay =
    p.documento && p.documento_tipo
      ? formatDocumento(p.documento, p.documento_tipo)
      : (p.documento ?? "");

  return (
    <GlassCard className="space-y-4 p-4 md:p-5" hover={false}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
          Dados cadastrais
        </p>
        <Hint className="mt-1">{COPY.contaIdentityHint}</Hint>
      </div>

      <PhotoPicker
        profile={p}
        caption="Foto"
        onUploaded={(next) =>
          qc.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, (prev: AccountProfile | undefined) =>
            prev ? { ...prev, ...next } : next,
          )
        }
      />

      <label className="block text-sm text-podium-gray">
        Como se chama
        <Hint className="mt-0.5">{COPY.comoChama}</Hint>
        <input
          defaultValue={p.como_chama ?? ""}
          onBlur={(e) => save.mutate({ como_chama: e.target.value })}
          className={CONTA_FIELD_CLASS}
        />
      </label>

      <label className="block text-sm text-podium-gray">
        Nome completo
        <input
          defaultValue={p.nome ?? ""}
          onBlur={(e) => save.mutate({ nome: e.target.value })}
          className={CONTA_FIELD_CLASS}
        />
      </label>

      <MarketFields
        especialidade={p.especialidade ?? ""}
        onEspecialidade={(especialidade) => save.mutate({ especialidade })}
        commitText="blur"
      />
      <CargoFields
        cargo={p.cargo ?? ""}
        onCargo={(cargo) => save.mutate({ cargo })}
        commitText="blur"
      />

      <label className="block text-sm text-podium-gray">
        Empresa
        <input
          defaultValue={p.empresa_usuario ?? ""}
          onBlur={(e) => save.mutate({ empresa_usuario: e.target.value })}
          className={CONTA_FIELD_CLASS}
        />
      </label>

      <label className="block text-sm text-podium-gray">
        Cidade
        <input
          defaultValue={p.cidade_usuario ?? ""}
          onBlur={(e) => save.mutate({ cidade_usuario: e.target.value })}
          className={CONTA_FIELD_CLASS}
        />
      </label>

      <label className="block text-sm text-podium-gray">
        CPF ou CNPJ
        <Hint className="mt-0.5">{COPY.contaDocumentoHint}</Hint>
        <input
          defaultValue={documentoDisplay}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              setDocError(null);
              save.mutate({ documento: null, documento_tipo: null });
              return;
            }
            const parsed = parseDocumento(raw);
            if (!parsed) {
              setDocError("Informe um CPF ou CNPJ válido.");
              return;
            }
            setDocError(null);
            e.target.value = formatDocumento(parsed.digits, parsed.tipo);
            save.mutate({
              documento: parsed.digits,
              documento_tipo: parsed.tipo,
            });
          }}
          className={CONTA_FIELD_CLASS}
        />
        {docError ? (
          <p className="mt-1 text-xs text-podium-alert">{docError}</p>
        ) : null}
      </label>
    </GlassCard>
  );
}

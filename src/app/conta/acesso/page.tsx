"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password";
import { CONTA_FIELD_CLASS } from "@/lib/conta";
import { COPY } from "@/lib/copy";

export default function ContaAcessoPage() {
  const profileQuery = useAccountProfile();
  const p = profileQuery.data;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password",
          password,
          dest: "/conta/acesso",
        }),
      });
      const json = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar a senha");
      setPassword("");
      setConfirm("");
      if (json.next && json.next !== "/conta/acesso") {
        window.location.href = json.next;
        return;
      }
      setNotice("Senha atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a senha");
    } finally {
      setBusy(false);
    }
  }

  if (!p) {
    return <div className="min-h-40 animate-pulse rounded-md bg-white/5" />;
  }

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3 p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          E-mail
        </p>
        <p className="text-lg font-semibold text-podium-white">
          {p.email?.trim() || "Não informado"}
        </p>
        <Hint>{COPY.contaEmailHint}</Hint>
        <Link
          href="/conta/ajuda"
          className="inline-block text-xs font-semibold text-podium-yellow"
        >
          Falar com o atendimento
        </Link>
      </GlassCard>

      <GlassCard className="p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Senha
        </p>
        <Hint className="mt-1">{COPY.contaPasswordHint}</Hint>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <label className="block text-xs text-podium-gray">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={CONTA_FIELD_CLASS}
            />
          </label>
          <label className="block text-xs text-podium-gray">
            Confirmar senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={CONTA_FIELD_CLASS}
            />
          </label>
          {error ? <p className="text-sm text-podium-alert">{error}</p> : null}
          {notice ? <p className="text-sm text-podium-success">{notice}</p> : null}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Salvando…" : "Atualizar senha"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}

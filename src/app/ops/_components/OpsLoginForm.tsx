"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { OPS_LOGIN_HANDLE } from "@/lib/ops/handle";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const fieldClass =
  "mt-1 w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export function OpsLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const handleActive =
    email.trim().toLowerCase() === OPS_LOGIN_HANDLE ||
    email.trim().toLowerCase() === "podiumadmin";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível entrar");
        return;
      }
      router.replace("/ops");
      router.refresh();
    } catch {
      setError("Não foi possível entrar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <BrandLogo variant="endorsed" className="h-10" />
      <h1 className="mt-6 text-xl font-semibold tracking-tight">Ops</h1>
      <Hint className="mt-2">Área interna. Só quem tem o link e a senha.</Hint>
      <GlassCard className="mt-4 p-3" hover={false}>
        {!configured ? (
          <p className="text-sm text-podium-muted">
            Ops desligado. Defina GRID_OPS_PASSWORD no servidor.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Atalho
              </p>
              <button
                type="button"
                onClick={() => setEmail(OPS_LOGIN_HANDLE)}
                className={cn(
                  "mt-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                  handleActive
                    ? "border-podium-yellow/50 bg-podium-yellow/15 text-podium-yellow"
                    : "border-white/10 bg-white/[0.04] text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white",
                )}
              >
                {OPS_LOGIN_HANDLE}
              </button>
              <Hint className="mt-2">
                Mesmo acesso da conta de administração. Digite o atalho ou o
                e-mail — a senha continua a mesma.
              </Hint>
            </div>
            <label className="block text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              E-mail ou {OPS_LOGIN_HANDLE}
              <input
                className={fieldClass}
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder={OPS_LOGIN_HANDLE}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              Senha
              <input
                className={fieldClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="text-sm text-podium-alert">{error}</p>
            ) : null}
            <Button type="submit" variant="primary" size="md" disabled={pending} className="w-full">
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}

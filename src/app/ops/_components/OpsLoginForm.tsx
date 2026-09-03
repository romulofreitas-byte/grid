"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { useRouter } from "next/navigation";
import { useState } from "react";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export function OpsLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Ops</h1>
      <Hint className="mt-2">Área interna. Só quem tem o link e a senha.</Hint>
      <GlassCard className="mt-6 p-6" hover={false}>
        {!configured ? (
          <p className="text-sm text-podium-muted">
            Ops desligado. Defina GRID_OPS_PASSWORD no servidor.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-semibold">
              E-mail
              <input
                className={fieldClass}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
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
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-podium-yellow px-4 py-2.5 text-sm font-extrabold text-podium-navy disabled:opacity-60"
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}

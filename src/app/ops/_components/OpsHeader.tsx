"use client";

import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function OpsHeader() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/ops/logout", { method: "POST" });
    router.replace("/ops/entrar");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/ops" className="flex items-center gap-3">
        <BrandLogo variant="solo" className="h-8" />
        <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-podium-muted">
          Ops
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-podium-muted hover:border-white/20 hover:text-podium-white"
      >
        Sair
      </button>
    </header>
  );
}

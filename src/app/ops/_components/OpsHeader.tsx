"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";
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
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/ops" className="flex items-center gap-3">
        <BrandLogo variant="solo" className="h-8" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
          Ops
        </span>
      </Link>
      <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <Link href="/ops?tab=ranking" className="text-podium-gray hover:text-podium-white">
          Ranking
        </Link>
        <Link href="/ops?tab=conta" className="text-podium-gray hover:text-podium-white">
          Conta
        </Link>
        <Link href="/ops/mural" className="text-podium-gray hover:text-podium-white">
          Mural
        </Link>
        <Link href="/ops/nichos" className="text-podium-gray hover:text-podium-white">
          Nichos
        </Link>
        <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
          Sair
        </Button>
      </nav>
    </header>
  );
}

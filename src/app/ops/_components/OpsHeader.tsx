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
    <header className="flex items-center justify-between gap-4">
      <Link href="/ops" className="flex items-center gap-3">
        <BrandLogo variant="solo" className="h-8" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
          Ops
        </span>
      </Link>
      <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
        Sair
      </Button>
    </header>
  );
}

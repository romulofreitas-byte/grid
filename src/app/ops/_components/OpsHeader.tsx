"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { FocusSwitch } from "@/components/FocusSwitch";
import { useFocusMode } from "@/components/FocusModeProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function OpsHeader() {
  const router = useRouter();
  const { on, toggle: toggleFocus } = useFocusMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const focusOn = mounted && on;

  async function logout() {
    await fetch("/api/ops/logout", { method: "POST" });
    router.replace("/ops/entrar");
    router.refresh();
  }

  return (
    <div
      className={cn(
        "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:duration-0",
        focusOn ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
      aria-hidden={focusOn || undefined}
      inert={focusOn || undefined}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 overflow-hidden">
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
          <FocusSwitch
            on={focusOn}
            onToggle={toggleFocus}
            className="hidden md:inline-flex"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
            Sair
          </Button>
        </nav>
      </header>
    </div>
  );
}

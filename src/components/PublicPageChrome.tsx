"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { BrandLogo } from "@/components/BrandLogo";
import { FocusSwitch } from "@/components/FocusSwitch";
import { useFocusMode } from "@/components/FocusModeProvider";
import { cn } from "@/lib/utils";

export function PublicPageChrome({
  back,
}: {
  back: { href: string; label: string };
}) {
  const { on, toggle } = useFocusMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const focusOn = mounted && on;

  return (
    <div
      className={cn(
        "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:duration-0",
        focusOn ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
      aria-hidden={focusOn || undefined}
      inert={focusOn || undefined}
    >
      <div className="overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <Link href={back.href} className="inline-block">
            <BrandLogo
              variant="endorsed"
              className="h-10 w-auto text-[2.5rem]"
            />
          </Link>
          <FocusSwitch
            on={focusOn}
            onToggle={toggle}
            className="hidden shrink-0 md:inline-flex"
          />
        </div>
        <div className="mt-4">
          <BackLink href={back.href}>{back.label}</BackLink>
        </div>
      </div>
    </div>
  );
}

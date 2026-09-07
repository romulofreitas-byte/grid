"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app_error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <GlassCard highlight hover={false} className="max-w-md p-5 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          GRID
        </p>
        <p className="mt-2 text-balance text-base font-semibold">{COPY.errorPageTitle}</p>
        <p className="mt-2 text-pretty text-sm text-podium-gray">{COPY.errorPageBody}</p>
        <Button type="button" variant="primary" size="md" className="mt-4" onClick={() => reset()}>
          {COPY.errorPageRetry}
        </Button>
      </GlassCard>
    </div>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFocusMode } from "@/components/FocusModeProvider";
import { CATCHUP_SESSION_KEY } from "@/lib/catchup/constants";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

function toastCopy(created: number): string {
  if (created === 1) return COPY.crmCatchUpToastOne;
  return COPY.crmCatchUpToastMany.replace("{n}", String(created));
}

export function CatchUpRunner() {
  const qc = useQueryClient();
  const router = useRouter();
  const { on: focusOn } = useFocusMode();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(CATCHUP_SESSION_KEY) === "done") return;
    started.current = true;
    sessionStorage.setItem(CATCHUP_SESSION_KEY, "running");

    let cancelled = false;
    void (async () => {
      let created = 0;
      let hasMore = true;
      try {
        while (hasMore && !cancelled) {
          const res = await fetch("/api/session/catch-up", { method: "POST" });
          if (!res.ok) {
            sessionStorage.removeItem(CATCHUP_SESSION_KEY);
            return;
          }
          const data = (await res.json()) as {
            created?: number;
            hasMore?: boolean;
          };
          created += data.created ?? 0;
          hasMore = Boolean(data.hasMore);
        }
      } catch {
        sessionStorage.removeItem(CATCHUP_SESSION_KEY);
        return;
      }
      if (cancelled) return;
      sessionStorage.setItem(CATCHUP_SESSION_KEY, "done");
      if (created > 0) {
        void qc.invalidateQueries({ queryKey: ["grid"] });
        void qc.invalidateQueries({ queryKey: ["lead"] });
        router.refresh();
        setMessage(toastCopy(created));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qc, router]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(id);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 bottom-20 z-50 max-w-sm rounded-md border border-white/15 bg-podium-navy/80 px-3 py-2.5 text-sm text-podium-white shadow-2xl backdrop-blur-2xl md:bottom-6",
        focusOn && "md:bottom-16",
      )}
    >
      {message}
    </div>
  );
}

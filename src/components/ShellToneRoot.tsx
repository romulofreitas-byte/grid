"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AngularBackground } from "@/components/AngularBackground";
import {
  pathMatchesDest,
  pathShellTone,
  sameOriginNavHref,
} from "@/lib/shell-tone";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function waitTwoFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function ShellToneRoot() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const waitingRef = useRef<{ path: string; resolve: () => void } | null>(null);

  useEffect(() => {
    const waiting = waitingRef.current;
    if (!waiting) return;
    if (pathMatchesDest(pathname, waiting.path)) {
      waiting.resolve();
      waitingRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const href = sameOriginNavHref(
        link.getAttribute("href"),
        window.location.origin,
      );
      if (!href) return;
      const nextPath = new URL(href, window.location.origin).pathname;
      if (pathShellTone(nextPath) === pathShellTone(pathnameRef.current)) {
        return;
      }
      if (pathMatchesDest(pathnameRef.current, nextPath)) return;

      if (
        prefersReducedMotion() ||
        typeof document.startViewTransition !== "function"
      ) {
        return;
      }

      if (waitingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const arrived = new Promise<void>((resolve) => {
        waitingRef.current = { path: nextPath, resolve };
      });

      document.startViewTransition(async () => {
        router.push(href);
        await Promise.race([
          arrived,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 20_000);
          }),
        ]);
        waitingRef.current = null;
        await waitTwoFrames();
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return <AngularBackground />;
}

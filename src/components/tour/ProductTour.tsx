"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { COPY } from "@/lib/copy";
import type { Profile } from "@/lib/types";
import {
  backTour,
  clearTourCompleted,
  clearTourSession,
  firstIndexForScene,
  isTourCompleted,
  nextTour,
  persistTourCompleted,
  readTourSession,
  startTour,
  tourPathFor,
  tourStepAt,
  writeTourSession,
  type TourOrigin,
  type TourSession,
} from "@/lib/tour";

function currentTourPath(pathname: string, search: string): string {
  if (pathname === "/tour") {
    return search.includes("from=app") ? "/tour?from=app" : "/tour";
  }
  return pathname;
}

function finishHref(origin: TourOrigin, signedIn: boolean): string {
  if (origin === "app" || signedIn) return "/painel";
  return "/entrar?modo=cadastro";
}

function finishLabelFor(origin: TourOrigin, signedIn: boolean): string {
  if (origin === "app" || signedIn) return COPY.tourFinishApp;
  return COPY.tourFinishLanding;
}

export function ProductTour({
  surface,
  children,
}: {
  surface: "painel" | "stage";
  children?: (session: TourSession | null) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<TourSession | null>(null);
  const started = useRef(false);
  const replay = searchParams.get("tour") === "1";
  const fromApp = searchParams.get("from") === "app";

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    },
    retry: false,
  });

  const userId = profileQuery.data?.id ?? null;
  const signedIn = Boolean(profileQuery.data?.id);
  const profileReady = !profileQuery.isPending;

  const persist = useCallback((next: TourSession | null) => {
    setSession(next);
    if (next) writeTourSession(next);
    else clearTourSession();
  }, []);

  const endTour = useCallback(
    (origin: TourOrigin, mode: "skip" | "finish") => {
      persistTourCompleted(origin, signedIn, userId);
      persist(null);
      if (mode === "finish") {
        router.push(finishHref(origin, signedIn));
        return;
      }
      if (origin === "app" && pathname !== "/painel") {
        router.push("/painel");
      }
    },
    [pathname, persist, router, signedIn, userId],
  );

  useEffect(() => {
    if (surface !== "painel" || !replay) return;
    clearTourCompleted(userId);
    persist(startTour("app", 0));
    router.replace("/painel");
  }, [persist, replay, router, surface, userId]);

  useEffect(() => {
    if (started.current) return;
    if (surface === "painel" && !profileReady) return;
    if (surface === "painel" && replay) return;
    started.current = true;

    const stored = readTourSession();
    if (stored) {
      persist(stored);
      return;
    }

    if (surface === "stage") {
      persist(
        startTour(
          fromApp ? "app" : "landing",
          fromApp ? firstIndexForScene("grid") : 0,
        ),
      );
      return;
    }

    if (!isTourCompleted(userId)) {
      persist(startTour("app", 0));
    }
  }, [fromApp, persist, profileReady, replay, surface, userId]);

  useEffect(() => {
    if (!session) return;
    const here = currentTourPath(pathname, searchParams.toString());
    const dest = tourPathFor(session.index, session.origin);
    if (here !== dest) router.replace(dest);
  }, [pathname, router, searchParams, session]);

  const goNext = useCallback(() => {
    if (!session) return;
    const result = nextTour(session);
    if (result.kind === "done") {
      endTour(result.origin, "finish");
      return;
    }
    persist(result.session);
  }, [endTour, persist, session]);

  const goBack = useCallback(() => {
    if (!session) return;
    persist(backTour(session));
  }, [persist, session]);

  const skip = useCallback(() => {
    if (!session) return;
    endTour(session.origin, "skip");
  }, [endTour, session]);

  const step = session ? tourStepAt(session.index) : null;
  const overlay =
    session && step ? (
      <TourOverlay
        step={step}
        index={session.index}
        finishLabel={finishLabelFor(session.origin, signedIn)}
        onNext={goNext}
        onBack={goBack}
        onSkip={skip}
      />
    ) : null;

  const child = useMemo(
    () => (children ? children(session) : null),
    [children, session],
  );

  return (
    <>
      {child}
      {overlay}
    </>
  );
}

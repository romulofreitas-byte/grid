"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductTour } from "@/components/tour/ProductTour";
import { TourStage } from "@/components/tour/TourStage";
import { COPY } from "@/lib/copy";
import {
  tourStepAt,
  type TourScene,
  type TourSession,
} from "@/lib/tour";

function TourStageGate({
  session,
  initial,
}: {
  session: TourSession | null;
  initial: TourScene;
}) {
  const [scene, setScene] = useState<TourScene>(initial);
  useEffect(() => {
    const next = session ? tourStepAt(session.index)?.scene : null;
    if (next) setScene(next);
  }, [session]);
  return <TourStage scene={scene} />;
}

function TourExperience() {
  const fromApp = useSearchParams().get("from") === "app";
  return (
    <ProductTour surface="stage">
      {(session) => (
        <TourStageGate
          session={session}
          initial={fromApp ? "grid" : "painel"}
        />
      )}
    </ProductTour>
  );
}

export default function TourPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-podium-muted">{COPY.tourPageTitle}…</p>
      }
    >
      <TourExperience />
    </Suspense>
  );
}

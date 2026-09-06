import { COPY } from "@/lib/copy";

export type TourScene = "painel" | "grid";
export type TourPlacement = "top" | "bottom" | "left" | "right";
export type TourOrigin = "app" | "landing";

export type TourStep = {
  id: string;
  scene: TourScene;
  target: string;
  placement: TourPlacement;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "painel-welcome",
    scene: "painel",
    target: "painel",
    placement: "bottom",
    title: COPY.tourStepPainelWelcomeTitle,
    body: COPY.tourStepPainelWelcomeBody,
  },
  {
    id: "painel-goal",
    scene: "painel",
    target: "painel-meta",
    placement: "right",
    title: COPY.tourStepPainelGoalTitle,
    body: COPY.tourStepPainelGoalBody,
  },
  {
    id: "painel-call",
    scene: "painel",
    target: "ligar-agora",
    placement: "bottom",
    title: COPY.tourStepPainelCallTitle,
    body: COPY.tourStepPainelCallBody,
  },
  {
    id: "painel-new-list",
    scene: "painel",
    target: "nova-lista",
    placement: "right",
    title: COPY.tourStepPainelNewListTitle,
    body: COPY.tourStepPainelNewListBody,
  },
  {
    id: "grid-order",
    scene: "grid",
    target: "grid-order",
    placement: "bottom",
    title: COPY.tourStepGridOrderTitle,
    body: COPY.tourStepGridOrderBody,
  },
  {
    id: "grid-row",
    scene: "grid",
    target: "grid-row",
    placement: "bottom",
    title: COPY.tourStepGridRowTitle,
    body: COPY.tourStepGridRowBody,
  },
  {
    id: "grid-qualify",
    scene: "grid",
    target: "grid-qualify",
    placement: "bottom",
    title: COPY.tourStepGridQualifyTitle,
    body: COPY.tourStepGridQualifyBody,
  },
  {
    id: "grid-save",
    scene: "grid",
    target: "grid-save",
    placement: "bottom",
    title: COPY.tourStepGridSaveTitle,
    body: COPY.tourStepGridSaveBody,
  },
];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;

export function tourStepAt(index: number): TourStep | null {
  return TOUR_STEPS[index] ?? null;
}

export function firstIndexForScene(scene: TourScene): number {
  const index = TOUR_STEPS.findIndex((step) => step.scene === scene);
  return index < 0 ? 0 : index;
}

export function tourPathFor(
  index: number,
  origin: TourOrigin,
): "/painel" | "/tour" | "/tour?from=app" {
  if (origin === "landing") return "/tour";
  const step = tourStepAt(index);
  return step?.scene === "grid" ? "/tour?from=app" : "/painel";
}

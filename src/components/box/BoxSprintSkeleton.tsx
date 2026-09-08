import { CrmOpeningChip } from "@/components/crm/CrmBoardSkeleton";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />
  );
}

export function BoxSprintSkeleton({
  opening = false,
}: {
  opening?: boolean;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {opening ? (
        <div className="shrink-0">
          <CrmOpeningChip label={COPY.boxOpening} />
        </div>
      ) : null}
      <div className="relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-4">
          <Pulse className="h-4 w-28" />
          <Pulse className="h-4 w-24" />
          <Pulse className="ml-auto h-4 w-20" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
            {COPY.boxNow}
          </p>
          <div className="flex gap-1">
            <Pulse className="h-5 w-16" />
            <Pulse className="h-5 w-12" />
            <Pulse className="h-5 w-16" />
            <Pulse className="h-5 w-24" />
          </div>
        </div>
        <div className="border-b border-white/10 px-4 py-3">
          <Pulse className="h-4 w-2/3 max-w-md" />
          <Pulse className="mt-2 h-3 w-28" />
          <Pulse className="mt-2 h-3 w-52 max-w-full" />
        </div>
        <div className="flex min-h-0 flex-col px-3 py-2">
          <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
            {COPY.boxQueue}
          </p>
          <Pulse className="h-8 w-full" />
          <Pulse className="mt-1 h-8 w-full opacity-80" />
          <Pulse className="mt-1 h-8 w-full opacity-60" />
        </div>
      </div>
    </div>
  );
}

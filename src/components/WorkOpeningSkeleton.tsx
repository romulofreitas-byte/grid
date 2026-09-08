import { CrmOpeningChip } from "@/components/crm/CrmBoardSkeleton";
import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />
  );
}

export function WorkOpeningSkeleton({
  label,
  split = false,
}: {
  label: string;
  split?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden",
        split && "lg:flex-row",
      )}
    >
      <div className="shrink-0">
        <CrmOpeningChip label={label} />
      </div>
      {split ? (
        <>
          <div className="flex w-full shrink-0 flex-col gap-2 lg:h-full lg:w-[22rem]">
            <Pulse className="h-10 w-full" />
            <Pulse className="h-16 w-full" />
            <Pulse className="h-16 w-full opacity-80" />
            <Pulse className="h-16 w-full opacity-60" />
          </div>
          <div className="min-h-0 min-w-0 flex-1 space-y-3">
            <Pulse className="h-40 w-full rounded-lg" />
            <Pulse className="h-28 w-full rounded-lg opacity-80" />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Pulse className="h-4 w-2/3 max-w-md" />
          <Pulse className="h-32 w-full rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Pulse className="h-28 w-full rounded-lg" />
            <Pulse className="h-28 w-full rounded-lg opacity-80" />
          </div>
        </div>
      )}
    </div>
  );
}

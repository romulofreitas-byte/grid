import { cn } from "@/lib/utils";

export type BrandLogoVariant = "mark" | "solo" | "endorsed";

function GridMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 153.08 153.08"
      aria-hidden
      className={className}
    >
      <polygon
        points="14.00,129.54 40.00,129.54 45.40,99.54 19.40,99.54"
        fill="#F5B301"
      />
      <polygon
        points="54.00,129.54 80.00,129.54 85.40,99.54 59.40,99.54"
        fill="#FFFFFF"
      />
      <polygon
        points="40.84,91.54 66.84,91.54 72.24,61.54 46.24,61.54"
        fill="#FFFFFF"
      />
      <polygon
        points="80.84,91.54 106.84,91.54 112.24,61.54 86.24,61.54"
        fill="#FFFFFF"
      />
      <polygon
        points="67.68,53.54 93.68,53.54 99.08,23.54 73.08,23.54"
        fill="#FFFFFF"
      />
      <polygon
        points="107.68,53.54 133.68,53.54 139.08,23.54 113.08,23.54"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function BrandLogo({
  variant,
  className,
  priority = false,
}: {
  variant: BrandLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  void priority;
  const endorsed = variant === "endorsed";
  const label = endorsed ? "GRID, um produto Mundo Pódium" : "GRID";

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center", className)}
    >
      <GridMark className="h-full w-auto shrink-0" />
      {variant !== "mark" ? (
        <span
          className={cn(
            "ml-[0.28em] flex h-full min-w-0 flex-col justify-center",
            endorsed && "justify-center gap-[0.1em]",
          )}
        >
          <span
            className={cn(
              "font-extrabold leading-none tracking-tight text-podium-white whitespace-nowrap",
              endorsed ? "text-[0.52em]" : "text-[0.68em]",
            )}
          >
            GRID
          </span>
          {endorsed ? (
            <span className="whitespace-nowrap font-semibold uppercase leading-none tracking-[0.22em] text-[0.18em] text-podium-muted">
              Mundo Pódium
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

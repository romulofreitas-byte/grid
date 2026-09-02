import { cn } from "@/lib/utils";

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "flex items-center gap-3 text-base font-semibold text-podium-white md:text-lg",
        className,
      )}
    >
      <span className="inline-block h-5 w-0.5 shrink-0 rounded-sm bg-podium-yellow" />
      {children}
    </h2>
  );
}

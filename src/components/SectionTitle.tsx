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
        "flex items-center gap-3 font-extrabold text-xl md:text-2xl text-podium-white",
        className,
      )}
    >
      <span className="inline-block h-7 w-1 shrink-0 rounded-sm bg-podium-yellow" />
      {children}
    </h2>
  );
}

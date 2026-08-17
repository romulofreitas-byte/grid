import { cn } from "@/lib/utils";

export function Hint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs leading-snug text-podium-muted", className)}>
      {children}
    </p>
  );
}

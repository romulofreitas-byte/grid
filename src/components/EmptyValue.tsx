import { cn } from "@/lib/utils";

export function EmptyValue({
  label = "NÃO ENCONTRADO",
  className,
}: {
  label?: "NÃO ENCONTRADO" | "NÃO VERIFICADO" | string;
  className?: string;
}) {
  return (
    <span className={cn("text-podium-muted text-sm font-medium", className)}>
      {label}
    </span>
  );
}

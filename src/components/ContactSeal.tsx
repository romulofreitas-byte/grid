import { sealDisplay, type ContactSealType } from "@/lib/contact-confidence";
import { cn } from "@/lib/utils";

export function ContactSealBadge({
  seal,
  label,
  className,
  compact = false,
}: {
  seal: ContactSealType;
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const display = sealDisplay(seal);
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span
        className={cn(
          "whitespace-nowrap text-xs font-bold tracking-wide",
          display.colorClass,
        )}
        title={label}
      >
        {display.title}
      </span>
      {compact ? null : (
        <span className="line-clamp-2 min-w-0 text-xs leading-snug text-podium-muted">
          {label}
        </span>
      )}
    </div>
  );
}

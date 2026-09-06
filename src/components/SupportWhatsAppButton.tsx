import { MessageCircle } from "lucide-react";
import { supportWhatsAppHref } from "@/lib/support";
import { cn } from "@/lib/utils";

export function SupportWhatsAppButton({
  name,
  pathname,
  className,
  children,
}: {
  name?: string | null;
  pathname?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const href = supportWhatsAppHref({ name, pathname });
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-podium-success px-3 text-xs font-medium text-podium-navy transition hover:brightness-110",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {children ?? "Falar no WhatsApp"}
    </a>
  );
}

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
        "inline-flex items-center justify-center gap-2 rounded-xl bg-podium-success px-4 py-2.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {children ?? "Falar no WhatsApp"}
    </a>
  );
}

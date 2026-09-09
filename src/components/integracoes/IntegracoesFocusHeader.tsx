import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  IntegrationLogo,
  type IntegrationLogoSource,
} from "@/components/IntegrationLogo";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function IntegracoesFocusHeader({
  item,
  title,
  status,
  className,
}: {
  item?: IntegrationLogoSource;
  title: string;
  status?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link
        href="/integracoes"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-podium-muted transition hover:text-podium-yellow"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {COPY.integracoesHubBack}
      </Link>
      {item ? <IntegrationLogo item={item} size="lg" active /> : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-podium-white">{title}</p>
        {status ? (
          <p className="mt-0.5 text-[11px] text-podium-muted">{status}</p>
        ) : null}
      </div>
    </div>
  );
}

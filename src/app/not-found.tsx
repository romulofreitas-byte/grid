import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <GlassCard highlight hover={false} className="max-w-md p-5 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          GRID
        </p>
        <p className="mt-2 text-balance text-base font-semibold">{COPY.notFoundTitle}</p>
        <p className="mt-2 text-pretty text-sm text-podium-gray">{COPY.notFoundBody}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/painel" className={buttonClassName({ variant: "primary", size: "md" })}>
            {COPY.notFoundHome}
          </Link>
          <Link href="/duvidas" className={buttonClassName({ variant: "secondary", size: "md" })}>
            {COPY.notFoundFaq}
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

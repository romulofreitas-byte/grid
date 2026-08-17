import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";
import { BackLink } from "@/components/BackLink";
import { BACK } from "@/lib/back";
import { cn } from "@/lib/utils";

export function PublicPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative min-h-screen px-4 py-12">
      <RaceAtmosphere />
      <div className={cn("mx-auto max-w-3xl", className)}>
        <Link href={BACK.inicio.href} className="inline-block">
          <BrandLogo
            variant="endorsed"
            className="h-10 w-auto text-[2.5rem]"
          />
        </Link>
        <div className="mt-6">
          <BackLink href={BACK.inicio.href}>{BACK.inicio.label}</BackLink>
        </div>
        {children}
      </div>
    </div>
  );
}

import { PublicPageChrome } from "@/components/PublicPageChrome";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";
import { BACK } from "@/lib/back";
import { cn } from "@/lib/utils";

export function PublicPage({
  children,
  className,
  back = BACK.inicio,
}: {
  children: React.ReactNode;
  className?: string;
  back?: { href: string; label: string };
}) {
  return (
    <div className="relative min-h-screen px-4 py-8">
      <RaceAtmosphere />
      <div className={cn("mx-auto max-w-3xl", className)}>
        <PublicPageChrome back={back} />
        {children}
      </div>
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  onClick,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = cn(
    "inline-block text-sm text-podium-muted transition hover:text-podium-white",
    className,
  );
  const content = <>← {children}</>;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { supportWhatsAppHref } from "@/lib/support";

export function PilotoProWaitlistCta({
  pathname,
  className,
}: {
  pathname: string;
  className?: string;
}) {
  const href = supportWhatsAppHref({
    pathname,
    intent: "piloto_pro_waitlist",
  });
  if (href) {
    return (
      <SupportWhatsAppButton
        pathname={pathname}
        intent="piloto_pro_waitlist"
        className={
          className ??
          buttonClassName({
            variant: "primary",
            size: "md",
            className: "w-full bg-podium-yellow text-podium-navy hover:brightness-110",
          })
        }
      >
        {COPY.landingPlansCtaWaitlist}
      </SupportWhatsAppButton>
    );
  }
  return (
    <span
      className={
        className ??
        buttonClassName({
          variant: "secondary",
          size: "md",
          className: "w-full",
        })
      }
    >
      {COPY.landingPlansCtaWaitlist}
    </span>
  );
}

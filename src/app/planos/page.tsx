import Link from "next/link";
import { PlanCard } from "@/components/billing/PlanCard";
import { PackCard } from "@/components/billing/PackCard";
import { PilotoProWaitlistCta } from "@/components/billing/PilotoProWaitlistCta";
import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { COPY } from "@/lib/copy";
import { isSkuOnSale, PACKS, PLANS } from "@/lib/billing/catalog";
import { billingReturn, pagarHref } from "@/lib/billing/href";
import { getBalance } from "@/lib/billing/service";
import { requireSession } from "@/lib/auth/session";
import { buttonClassName } from "@/components/ui/Button";

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const back = billingReturn(from);
  const billed = PLANS.filter((p) => p.sku !== "membro_plataforma");
  const session = await requireSession();
  const couponActivated = session
    ? (await getBalance(session.id)).plano === "membro_plataforma"
    : false;

  return (
    <PublicPage className="max-w-6xl" back={back}>
      <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
        {COPY.landingPlansEyebrow}
      </p>
      <h1 className="mt-3 max-w-xl text-balance text-xl font-semibold tracking-tight text-podium-white md:text-2xl">
        {COPY.landingPlansTitle}
      </h1>
      <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-podium-muted md:text-base">
        {COPY.landingPlansBody}
      </p>

      <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billed.map((plan) => {
          const featured = plan.sku === "piloto";
          const onSale = plan.sku === "free" || isSkuOnSale(plan.sku);
          const waitlist = plan.sku === "piloto_pro" && !onSale;
          const ctaClass = featured
            ? buttonClassName({ variant: "primary", size: "md", className: "w-full" })
            : onSale
              ? buttonClassName({ variant: "secondary", size: "md", className: "w-full" })
              : buttonClassName({
                  variant: "primary",
                  size: "md",
                  className: "w-full",
                });
          return (
            <div
              key={plan.sku}
              id={plan.sku === "piloto_pro" ? "piloto-pro" : undefined}
              className="scroll-mt-24 h-full"
            >
            <PlanCard
              plan={plan}
              featured={featured}
              eyebrow={
                featured
                  ? COPY.landingPlansFeatured
                  : plan.sku === "free"
                    ? "Começar"
                    : waitlist
                      ? COPY.landingPlansProEyebrow
                      : "Assinatura"
              }
              cta={
                onSale ? (
                  <Link
                    href={
                      plan.sku === "free" ? "/painel" : pagarHref(plan.sku, from)
                    }
                    className={ctaClass}
                  >
                    {plan.sku === "free"
                      ? "Continuar no treino"
                      : COPY.landingPlansCtaPaid}
                  </Link>
                ) : waitlist ? (
                  <PilotoProWaitlistCta pathname="/planos" />
                ) : (
                  <span aria-disabled="true" className={buttonClassName({
                    variant: "secondary",
                    size: "md",
                    className: "w-full cursor-not-allowed opacity-50",
                  })}>
                    {COPY.landingPlansCtaSoon}
                  </span>
                )
              }
            />
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-podium-muted">{COPY.landingPlansPayHint}</p>
      <p className="mt-1 text-sm text-podium-muted">{COPY.planosCreditNote}</p>

      <div id="recarga" className="scroll-mt-20">
        <SectionTitle className="mt-14">Recarga de créditos</SectionTitle>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-podium-muted md:text-base">
          {COPY.planosRecargaBody}
        </p>
        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
          {PACKS.map((pack) => {
            const featured = pack.sku === "pack_500";
            return (
              <PackCard
                key={pack.sku}
                pack={pack}
                featured={featured}
                eyebrow={
                  featured
                    ? COPY.landingPlansPackFeatured
                    : pack.sku === "pack_2000"
                      ? "Volume"
                      : "Avulsa"
                }
                cta={
                  <Link
                    href={pagarHref(pack.sku, from)}
                    className={buttonClassName({
                      variant: featured ? "primary" : "secondary",
                      size: "md",
                      className: "w-full",
                    })}
                  >
                    Recarregar
                  </Link>
                }
              />
            );
          })}
        </div>
      </div>

      {couponActivated ? null : (
      <GlassCard className="mt-6 p-3">
        <p className="text-sm font-semibold text-podium-white">Membro da Plataforma</p>
        <p className="mt-2 text-sm text-podium-gray">
          Quem já assina o Mundo Pódium entra no nível Piloto por 30 dias, sem
          pagar de novo no GRID. Cupom{" "}
          <span className="font-semibold text-podium-white">PILOTO</span> — vale
          só para assinantes ativos da Plataforma, com o mesmo e-mail do
          cadastro. Recarga só soma crédito.
        </p>
        <Link
          href={pagarHref("membro_plataforma", from)}
          className={buttonClassName({
            variant: "primary",
            size: "md",
            className: "mt-3",
          })}
        >
          Ativar com cupom
        </Link>
      </GlassCard>
      )}

      <GlassCard className="mt-4 p-3" highlight>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Dúvidas
        </p>
        <p className="mt-2 text-sm font-semibold text-podium-white">
          Crédito, selo e exportação
        </p>
        <p className="mt-1 text-sm text-podium-gray">
          Respostas rápidas antes de chamar o atendimento.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/duvidas"
            className={buttonClassName({ variant: "secondary", size: "md" })}
          >
            Ver dúvidas
          </Link>
          <SupportWhatsAppButton pathname="/planos" />
        </div>
      </GlassCard>
    </PublicPage>
  );
}

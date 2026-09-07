import Link from "next/link";
import { Check } from "lucide-react";
import { PlanCard } from "@/components/billing/PlanCard";
import { PilotoProWaitlistCta } from "@/components/billing/PilotoProWaitlistCta";
import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { COPY } from "@/lib/copy";
import { formatBrl, isSkuOnSale, PACKS, PLANS } from "@/lib/billing/catalog";
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
      <SectionTitle className="mt-4">Planos e créditos</SectionTitle>
      <p className="mt-3 max-w-2xl text-pretty text-sm text-podium-gray">
        Buscar e ligar pela ficha é grátis. Qualificar custa 1 crédito. Crédito do
        plano zera no mês.
      </p>

      <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billed.map((plan) => {
          const featured = plan.sku === "piloto";
          const waitlist = plan.sku === "piloto_pro";
          const onSale = plan.sku === "free" || isSkuOnSale(plan.sku);
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
                      : "Pagar com Pix"}
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

      <div id="recarga" className="scroll-mt-20">
        <SectionTitle className="mt-14">Recarga de créditos</SectionTitle>
        <p className="mt-3 max-w-2xl text-pretty text-sm text-podium-gray">
          Créditos extras para o meio do mês. Não expiram e somam no saldo da
          conta.
        </p>
        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
          {PACKS.map((pack) => (
            <GlassCard key={pack.sku} className="flex h-full flex-col p-3">
              <h3 className="text-sm font-semibold">{pack.nome}</h3>
              <p className="mt-1 min-h-8 text-xs leading-5 text-podium-muted">
                {pack.tagline}
              </p>
              <p className="mt-3 text-lg font-semibold text-podium-yellow">
                {formatBrl(pack.priceCents)}
              </p>
              <ul className="mt-3 min-h-[4.75rem] flex-1 space-y-2 text-sm text-podium-gray">
                {pack.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={pagarHref(pack.sku, from)}
                className={buttonClassName({
                  variant: "secondary",
                  size: "md",
                  className: "mt-4 w-full",
                })}
              >
                Recarregar
              </Link>
            </GlassCard>
          ))}
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

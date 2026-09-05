import Link from "next/link";
import { Check } from "lucide-react";
import { PlanCard } from "@/components/billing/PlanCard";
import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { COPY } from "@/lib/copy";
import { formatBrl, isSkuOnSale, PACKS, PLANS } from "@/lib/billing/catalog";
import { billingReturn, pagarHref } from "@/lib/billing/href";
import { getBalance } from "@/lib/billing/service";
import { requireSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

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
      <SectionTitle className="mt-8">Planos e créditos</SectionTitle>
      <p className="mt-3 max-w-2xl text-pretty text-sm text-podium-gray">
        Buscar e ligar pela ficha é grátis. Qualificar custa 1 crédito. Crédito do
        plano zera no mês.
      </p>

      <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billed.map((plan) => {
          const featured = plan.sku === "piloto";
          const onSale = plan.sku === "free" || isSkuOnSale(plan.sku);
          const ctaClass = cn(
            "inline-flex w-full justify-center rounded-xl py-3 text-sm font-extrabold transition",
            featured
              ? "bg-podium-yellow text-podium-navy hover:brightness-110"
              : onSale
                ? "border border-white/15 text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                : "cursor-not-allowed border border-white/10 text-podium-muted",
          );
          return (
            <PlanCard
              key={plan.sku}
              plan={plan}
              featured={featured}
              eyebrow={
                featured
                  ? COPY.landingPlansFeatured
                  : plan.sku === "free"
                    ? "Começar"
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
                ) : (
                  <span aria-disabled="true" className={ctaClass}>
                    {COPY.landingPlansCtaSoon}
                  </span>
                )
              }
            />
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
            <GlassCard key={pack.sku} className="flex h-full flex-col p-5">
              <h3 className="text-lg font-extrabold">{pack.nome}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm leading-5 text-podium-muted">
                {pack.tagline}
              </p>
              <p className="mt-4 text-2xl font-extrabold text-podium-yellow">
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
                className="mt-6 inline-flex justify-center rounded-xl border border-white/15 py-3 text-sm font-extrabold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
              >
                Recarregar
              </Link>
            </GlassCard>
          ))}
        </div>
      </div>

      {couponActivated ? null : (
      <GlassCard className="mt-10 p-5">
        <p className="text-sm font-bold text-podium-white">Membro da Plataforma</p>
        <p className="mt-2 text-sm text-podium-gray">
          Quem já assina o Mundo Pódium entra no nível Piloto por 30 dias, sem
          pagar de novo no GRID. Cupom{" "}
          <span className="font-extrabold text-podium-white">PILOTO</span> — vale
          só para assinantes ativos da Plataforma, com o mesmo e-mail do
          cadastro. Recarga só soma crédito.
        </p>
        <Link
          href={pagarHref("membro_plataforma", from)}
          className="mt-4 inline-flex rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110"
        >
          Ativar com cupom
        </Link>
      </GlassCard>
      )}

      <GlassCard className="mt-6 p-5" highlight>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
          Dúvidas
        </p>
        <p className="mt-2 text-sm font-bold text-podium-white">
          Crédito, selo e exportação
        </p>
        <p className="mt-1 text-sm text-podium-gray">
          Respostas rápidas antes de chamar o atendimento.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/duvidas"
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
          >
            Ver dúvidas
          </Link>
          <SupportWhatsAppButton pathname="/planos" />
        </div>
      </GlassCard>
    </PublicPage>
  );
}

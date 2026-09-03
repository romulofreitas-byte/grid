import Link from "next/link";
import { Check } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { formatBrl, EXPORT_CREDIT_COST, PACKS, PLANS } from "@/lib/billing/catalog";
import { billingReturn, pagarHref } from "@/lib/billing/href";
import { DEFAULT_PLATFORM_COUPON } from "@/lib/billing/platform-coupon";
import { cn } from "@/lib/utils";

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const back = billingReturn(from);
  const billed = PLANS.filter((p) => p.sku !== "membro_plataforma");

  return (
    <PublicPage className="max-w-6xl" back={back}>
      <SectionTitle className="mt-8">Planos e créditos</SectionTitle>
      <p className="mt-3 max-w-2xl text-sm text-podium-gray">
        Buscar e ver a lista é grátis. A mensalidade libera o CRM e a
        qualificação. Qualificar custa 1 crédito. Ligar pela ficha é grátis.
        Exportar a planilha custa {EXPORT_CREDIT_COST} créditos por empresa já
        qualificada. O crédito do plano zera no mês — recarga fica e não
        substitui a assinatura. Pix é o caminho padrão — cartão e boleto também
        entram.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billed.map((plan) => {
          const featured = plan.sku === "piloto";
          return (
            <GlassCard
              key={plan.sku}
              highlight={featured}
              className={cn("flex flex-col p-5", featured && "ring-1 ring-podium-yellow/30")}
            >
              {featured ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
                  Mais escolhido
                </p>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                  {plan.sku === "free" ? "Começar" : "Assinatura"}
                </p>
              )}
              <h3 className="mt-2 text-xl font-extrabold">{plan.nome}</h3>
              <p className="mt-1 text-sm text-podium-muted">{plan.tagline}</p>
              <p className="mt-4 text-3xl font-extrabold text-podium-yellow">
                {plan.priceCents === 0 ? "Grátis" : formatBrl(plan.priceCents)}
                {plan.priceCents > 0 ? (
                  <span className="text-sm font-medium text-podium-muted">/mês</span>
                ) : null}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-podium-gray">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.sku === "free" ? "/box" : pagarHref(plan.sku, from)}
                className={cn(
                  "mt-6 inline-flex justify-center rounded-xl py-3 text-sm font-extrabold transition",
                  featured
                    ? "bg-podium-yellow text-podium-navy hover:brightness-110"
                    : "border border-white/15 text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white",
                )}
              >
                {plan.sku === "free" ? "Continuar no treino" : "Pagar com Pix"}
              </Link>
            </GlassCard>
          );
        })}
      </div>

      <div id="recarga" className="scroll-mt-20">
        <SectionTitle className="mt-14">Recarga de créditos</SectionTitle>
        <p className="mt-3 max-w-2xl text-sm text-podium-gray">
          Pacotes não expiram e não substituem o plano — nem reabrem o CRM. O
          custo por crédito é pior que a assinatura: serve para o meio do mês
          ou para exportar.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PACKS.map((pack) => (
            <GlassCard key={pack.sku} className="flex flex-col p-5">
              <h3 className="text-lg font-extrabold">{pack.nome}</h3>
              <p className="mt-1 text-sm text-podium-muted">{pack.tagline}</p>
              <p className="mt-4 text-2xl font-extrabold text-podium-yellow">
                {formatBrl(pack.priceCents)}
              </p>
              <ul className="mt-3 flex-1 space-y-2 text-sm text-podium-gray">
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

      <GlassCard className="mt-10 p-5">
        <p className="text-sm font-bold text-podium-white">Membro da Plataforma</p>
        <p className="mt-2 text-sm text-podium-gray">
          Quem já assina o Mundo Pódium entra no nível Piloto por 30 dias, sem
          pagar de novo no GRID. No checkout, use o cupom {DEFAULT_PLATFORM_COUPON}. Depois,
          assine o Piloto. Recarga só soma crédito.
        </p>
        <Link
          href={pagarHref("membro_plataforma", from)}
          className="mt-4 inline-block text-sm font-bold text-podium-yellow hover:underline"
        >
          Ativar com cupom →
        </Link>
      </GlassCard>

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

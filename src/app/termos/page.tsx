import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";

export default function TermosPage() {
  return (
    <PublicPage>
      <SectionTitle className="mt-8">Termos de uso</SectionTitle>
      <GlassCard className="mt-6 space-y-4 p-6 text-sm leading-relaxed text-podium-gray">
        <p>
          O GRID é uma ferramenta de prospecção B2B do Mundo Pódium. O uso é
          destinado a quem usa o GRID e a equipes comerciais autorizadas.
        </p>
        <p>
          <strong className="text-podium-white">
            É proibida a revenda da base bruta
          </strong>{" "}
          obtida via GRID, no todo ou em parte, bem como a redistribuição em
          massa dos dados da Receita Federal fora do fluxo de prospecção
          legítima.
        </p>
        <p>
          Exportações (XLSX/CSV/PDF) destinam-se ao CRM e ao uso operacional do
          assinante. Google Maps / Places API não são utilizados. O GRID não
          grava texto de avaliação nem coordenadas; nota média e quantidade de
          avaliações do card público entram na qualificação.
        </p>
        <p>
          Pagamentos de planos e créditos são processados por{" "}
          <strong className="text-podium-white">Asaas</strong> (Pix, cartão
          brasileiro e boleto) e, quando você escolhe cartão internacional, por{" "}
          <strong className="text-podium-white">Stripe</strong>. O GRID não
          armazena número de cartão. Liquidação de tesouraria pode usar Circle
          Mint, sem aparecer no checkout.
        </p>
      </GlassCard>
    </PublicPage>
  );
}

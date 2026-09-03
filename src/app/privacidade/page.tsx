import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <PublicPage>
      <SectionTitle className="mt-8">Aviso de privacidade</SectionTitle>
      <GlassCard className="mt-6 space-y-4 p-6 text-sm leading-relaxed text-podium-gray">
        <p>
          O GRID utiliza dados dos{" "}
          <strong className="text-podium-white">Dados Abertos do CNPJ</strong> da
          Receita Federal do Brasil, de natureza pública.
        </p>
        <p>
          <strong className="text-podium-white">Finalidade:</strong> prospecção
          comercial B2B e qualificação de leads para cold call.
        </p>
        <p>
          <strong className="text-podium-white">Base legal:</strong> LGPD art. 7º,
          §4º (dados manifestamente públicos) e art. 7º, IX (legítimo interesse).
          Dados de pessoa jurídica não são dados pessoais; nome de sócio é
          tratado com cuidado — CPF nunca é armazenado nem exibido.
        </p>
        <p>
          Você pode pedir para uma empresa sair da base pelo{" "}
          <Link href="/opt-out" className="text-podium-yellow">
            formulário de oposição
          </Link>
          . Processamos em até 15 dias com blocklist permanente. CNPJ com
          oposição registrada não entra na fila de qualificação e não é
          crawleado.
        </p>
        <p>
          <strong className="text-podium-white">Crawl de sites públicos:</strong>{" "}
          o GridBot visita páginas públicas da empresa (home e contato) para
          confirmar telefone, WhatsApp, redes e sinais de mensuração. Base
          legal: LGPD art. 7º, IX (legítimo interesse) sobre dados
          manifestamente públicos em sites corporativos. O crawler se identifica
          como{" "}
          <code className="text-podium-yellow">GridBot/1.0</code>, respeita{" "}
          <code>robots.txt</code> e pode ser bloqueado — detalhes em{" "}
          <Link href="/bot" className="text-podium-yellow">
            /bot
          </Link>
          .
        </p>
        <p>
          <strong className="text-podium-white">OpenStreetMap:</strong> usamos
          dados do OSM apenas como confirmação booleana de um telefone já
          conhecido por outra fonte. O número do OSM nunca entra no export nem
          aparece sozinho na ficha. Dados © colaboradores do OpenStreetMap,
          disponíveis sob a{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/"
            className="text-podium-yellow"
            target="_blank"
            rel="noreferrer"
          >
            Open Database License (ODbL)
          </a>
          .
        </p>
        <p>
          <strong className="text-podium-white">Pagamentos:</strong> Asaas e
          Stripe processam cobrança de planos e créditos. CPF/CNPJ informado no
          checkout é enviado ao Asaas para emitir Pix, cartão ou boleto.
        </p>
      </GlassCard>
    </PublicPage>
  );
}

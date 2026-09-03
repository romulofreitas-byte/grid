import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import Link from "next/link";

export default function BotPage() {
  return (
    <PublicPage>
      <SectionTitle className="mt-8">GridBot/1.0</SectionTitle>
      <GlassCard className="mt-6 space-y-4 p-6 text-sm leading-relaxed text-podium-gray">
        <p>
          O <strong className="text-podium-white">GridBot</strong> é o crawler
          do GRID · Mundo Pódium. Ele visita sites públicos de empresas para
          confirmar telefone, WhatsApp, redes e sinais técnicos (pixel, GTM)
          que o Piloto vê na ficha.
        </p>
        <p>
          <strong className="text-podium-white">User-Agent:</strong>{" "}
          <code className="text-podium-yellow">
            Mozilla/5.0 (compatible; GridBot/1.0; +https://grid.mundopodium.com.br/bot)
          </code>
        </p>
        <p>
          <strong className="text-podium-white">O que coletamos:</strong> HTML
          público (home e páginas de contato), links <code>tel:</code> /{" "}
          <code>mailto:</code> / WhatsApp, handles de redes no header e rodapé,
          e assinaturas de scripts de mensuração. Não coletamos CPF, não
          entramos em área logada e não gravamos números vindos só do
          OpenStreetMap.
        </p>
        <p>
          <strong className="text-podium-white">Como bloquear:</strong> no{" "}
          <code>robots.txt</code> do seu site:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-4 text-xs text-podium-white">
{`User-agent: GridBot
Disallow: /`}
        </pre>
        <p>
          Um path bloqueado (por exemplo <code>Disallow: /contato</code>) é
          pulado — o bot não força a entrada. Respeitamos rate limit de 1
          requisição a cada 2 segundos por domínio.
        </p>
        <p>
          Oposição ao tratamento:{" "}
          <Link href="/opt-out" className="text-podium-yellow">
            /opt-out
          </Link>
          . Privacidade:{" "}
          <Link href="/privacidade" className="text-podium-yellow">
            /privacidade
          </Link>
          .
        </p>
      </GlassCard>
    </PublicPage>
  );
}

import { FaqList } from "@/components/FaqList";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { supportWhatsAppHref } from "@/lib/support";

export default function DuvidasPage() {
  const hasWhatsApp = Boolean(supportWhatsAppHref({ pathname: "/duvidas" }));

  return (
    <PublicPage>
      <SectionTitle className="mt-8">Dúvidas</SectionTitle>
      <p className="mt-3 max-w-2xl text-sm text-podium-gray">
        Respostas rápidas sobre o GRID. Se não estiver aqui, o atendimento
        entra no WhatsApp.
      </p>
      <div className="mt-6">
        <FaqList />
      </div>
      {hasWhatsApp ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-podium-muted">
            Não achou? Chama o atendimento.
          </p>
          <SupportWhatsAppButton pathname="/duvidas" />
        </div>
      ) : null}
    </PublicPage>
  );
}

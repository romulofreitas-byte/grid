import { notFound } from "next/navigation";
import { PublicLeadForm } from "@/components/automacoes/PublicLeadForm";
import { GlassCard } from "@/components/GlassCard";
import { hashInboundToken } from "@/lib/crm/inbound-token";
import { getRepo } from "@/lib/data";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { token } = await params;
  const { embed } = await searchParams;
  const endpoint = await getRepo().getCrmInboundEndpointByPublicTokenHash(
    hashInboundToken(token),
  );
  if (!endpoint || endpoint.channel !== "site") notFound();
  const embedded = embed === "1";

  return (
    <div className={cn("px-4 py-8", embedded ? "min-h-0" : "min-h-screen")}>
      <div className="mx-auto max-w-md">
        {embedded ? null : (
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            {COPY.publicFormEyebrow}
          </p>
        )}
        <GlassCard className="p-4 hover:translate-y-0">
          <PublicLeadForm
            token={token}
            nome={endpoint.nome}
            leadKind={endpoint.lead_kind}
            fields={endpoint.form_fields}
          />
        </GlassCard>
      </div>
    </div>
  );
}

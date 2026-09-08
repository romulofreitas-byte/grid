import { parseFormFields } from "@/lib/crm/form-fields";
import type { PublicInboundLastEvent } from "@/lib/crm/inbound-events";
import {
  inboundLeadsUrl,
  publicFormEmbedSnippet,
  publicFormUrl,
} from "@/lib/crm/inbound-token";
import type { CrmInboundEndpoint } from "@/lib/crm/types";

export function publicCampaign(
  row: CrmInboundEndpoint,
  origin: string,
  extras: {
    lastEvent?: PublicInboundLastEvent | null;
    publicToken?: string | null;
    webhookToken?: string | null;
  } = {},
) {
  const formUrl = extras.publicToken
    ? publicFormUrl(origin, extras.publicToken)
    : null;
  return {
    id: row.id,
    nome: row.nome,
    pipeline_id: row.pipeline_id,
    stage_id: row.stage_id,
    lead_kind: row.lead_kind,
    channel: row.channel,
    form_fields: parseFormFields(row.form_fields),
    meta_connection_id: row.meta_connection_id,
    meta_form_id: row.meta_form_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    url: inboundLeadsUrl(origin, row.id),
    form_url: formUrl,
    embed_snippet:
      extras.publicToken && formUrl
        ? publicFormEmbedSnippet(origin, extras.publicToken)
        : null,
    has_public_form: Boolean(row.public_token_hash),
    last_event: extras.lastEvent ?? null,
  };
}

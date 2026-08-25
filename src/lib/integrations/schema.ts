import { z } from "zod";

/** Phone sources allowed on an outbound payload. OSM is a boolean signal only. */
export const outboundPhoneSourceSchema = z.enum([
  "receita",
  "site_tel",
  "site_schema",
  "site_texto",
  "site_whatsapp",
]);

export const contactSealSchema = z.enum([
  "CONFIRMADO",
  "ATUALIZADO",
  "COMPARTILHADO",
  "GRUPO",
  "NAO_CONFIRMADO",
]);

export const sharedPhoneVerdictSchema = z.enum([
  "contabilidade",
  "grupo_economico",
  "proprio",
]);

export const provenanceSchema = z.object({
  valor: z.string(),
  fonte: z.string(),
  coletado_em: z.string(),
});

export const leadOutboundPhoneSchema = z.object({
  e164: z.string().regex(/^\+\d{8,15}$/),
  display: z.string(),
  tipo: z.enum(["fixo", "movel", "especial"]),
  sources: z.array(outboundPhoneSourceSchema).min(1),
  isWhatsApp: z.boolean(),
  seal: contactSealSchema,
  sharedCount: z.number().int().nonnegative().optional(),
  sharedVerdict: sharedPhoneVerdictSchema.optional(),
});

export const leadOutboundDecisorSchema = z.object({
  nome: z.string(),
  qualificacao: z.string(),
  data_entrada: z.string().nullable(),
  faixa_etaria: z.number().int().nullable(),
});

export const leadOutboundAddressSchema = z.object({
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cep: z.string().nullable(),
  municipio: z.string(),
  uf: z.string(),
});

export const leadOutboundEmailSchema = z.object({
  valor: z.string(),
  shared: z.boolean(),
  free: z.boolean(),
  accountantHint: z.boolean(),
  fonte: z.string(),
  coletado_em: z.string().nullable(),
});

export const goldenMinuteOutboundSchema = z.object({
  contexto: z.string(),
  facts: z.array(z.object({ phrase: z.string(), fonte: z.string() })),
  insufficient: z.boolean(),
});

/**
 * Canonical outbound lead. Adapters map from this JSON, never from the CSV.
 * Never includes CPF. Never includes an OSM-only telephone number.
 */
export const leadOutboundSchema = z
  .object({
    cnpj: z.string().regex(/^\d{14}$/),
    razao_social: z.string(),
    nome_fantasia: z.string().nullable(),
    is_matriz: z.boolean(),
    porte: z.string().nullable(),
    capital_social: z.number().nullable(),
    cnae_principal: z.string(),
    cnae_descricao: z.string(),
    address: leadOutboundAddressSchema,
    phones: z.array(leadOutboundPhoneSchema),
    email: leadOutboundEmailSchema.nullable(),
    whatsapp: z.string().nullable(),
    domain: z.string().nullable(),
    decisor: leadOutboundDecisorSchema.nullable(),
    grid_score: z.number().int(),
    grid_position: z.number().int().nullable(),
    status: z.enum(["novo", "ligando", "reuniao", "descartado"]),
    search_id: z.string().uuid(),
    search_name: z.string().nullable(),
    niche_slug: z.string().nullable(),
    segment_slugs: z.array(z.string()),
    dossier_url: z.string(),
    osm_matched: z.boolean().nullable(),
    golden_minute: goldenMinuteOutboundSchema.nullable(),
    fonte: z.record(z.string(), provenanceSchema),
  })
  .strict();

export const integrationKindSchema = z.enum(["crm", "dialer", "voip", "webhook"]);

export const integrationProviderSchema = z.enum([
  "webhook",
  "pipedrive",
  "hubspot",
  "rdstation",
  "kommo",
  "salesforce",
  "3cplus",
  "megadialer",
  "twilio",
  "zenvia",
  "asterisk",
  "api4com",
  "telnyx",
]);

export const liveVoipProviderSchema = z.enum([
  "api4com",
  "zenvia",
  "twilio",
  "telnyx",
]);

export const integrationVerbSchema = z.enum([
  "push_list",
  "originate_call",
  "ingest_outcome",
]);

export const outboundEnvelopeSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("lead.exported"),
    occurred_at: z.string(),
    connection_id: z.string().uuid(),
    search_id: z.string().uuid().nullable(),
    lead: leadOutboundSchema,
  }),
  z.object({
    event: z.literal("list.exported"),
    occurred_at: z.string(),
    connection_id: z.string().uuid(),
    search_id: z.string().uuid().nullable(),
    leads: z.array(leadOutboundSchema),
  }),
]);

export const inboundOutcomeSchema = z
  .object({
    event: z.literal("call.outcome").default("call.outcome"),
    occurred_at: z.string().optional(),
    cnpj: z
      .string()
      .regex(/^\d{14}$/)
      .optional(),
    e164: z
      .string()
      .regex(/^\+\d{8,15}$/)
      .optional(),
    disposition: z.string().min(1),
    notes: z.string().optional(),
    duration_sec: z.number().int().nonnegative().optional(),
    external_id: z.string().optional(),
  })
  .refine((body) => Boolean(body.cnpj || body.e164), {
    message: "cnpj or e164 is required",
  });

export type LeadOutbound = z.infer<typeof leadOutboundSchema>;
export type LeadOutboundPhone = z.infer<typeof leadOutboundPhoneSchema>;
export type OutboundEnvelope = z.infer<typeof outboundEnvelopeSchema>;
export type InboundOutcome = z.infer<typeof inboundOutcomeSchema>;
export type IntegrationKind = z.infer<typeof integrationKindSchema>;
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type LiveVoipProvider = z.infer<typeof liveVoipProviderSchema>;
export type IntegrationVerb = z.infer<typeof integrationVerbSchema>;
export type OutboundPhoneSource = z.infer<typeof outboundPhoneSourceSchema>;

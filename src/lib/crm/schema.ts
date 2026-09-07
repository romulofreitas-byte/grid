import { z } from "zod";
import { MAX_DEAL_AMOUNT_CENTS } from "@/lib/crm/money";
import {
  CRM_ACTIVITY_KINDS,
  CRM_DEAL_SOURCES,
  CRM_EVENT_KINDS,
  CRM_FORM_CHANNELS,
  CRM_LEAD_KINDS,
  CRM_OUTCOMES,
} from "@/lib/crm/types";

export const IMPORT_MAX_ROWS = 1000;

export const crmPersonSchema = z.object({
  name: z.string().trim().max(80),
  phone: z.string().trim().max(24),
  email: z.string().trim().max(120),
});

export const pipelineNameSchema = z.string().trim().min(1).max(80);

export const pipelineCreateSchema = z.object({
  nome: pipelineNameSchema,
});

export const pipelinePatchSchema = z.object({
  nome: pipelineNameSchema.optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export const pipelineReorderSchema = z.object({
  pipelineIds: z.array(z.string().uuid()).min(1).max(40),
});

export const stageCreateSchema = z.object({
  nome: pipelineNameSchema,
});

export const stagePatchSchema = z.object({
  nome: pipelineNameSchema.optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export const stageDeleteSchema = z.object({
  moveToStageId: z.string().uuid().optional(),
});

export const stageReorderSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1).max(40),
});

export const dealCreateSchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  contact_name: z.string().trim().max(80).optional(),
  secretaries: z.array(z.string().trim().max(80)).max(8).optional(),
  phones: z.array(z.string().trim().max(24)).max(8).optional(),
  stage_id: z.string().uuid().optional(),
  notes: z.string().max(4000).optional(),
  cnpj: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null || value === "") return undefined;
      const digits = value.replace(/\D/g, "");
      if (!digits) return undefined;
      return digits.padStart(14, "0");
    })
    .refine((value) => value === undefined || /^\d{14}$/.test(value), {
      message: "CNPJ inválido",
    }),
  people: z.array(crmPersonSchema).max(12).optional(),
  meta: z
    .object({
      source: z.enum(CRM_DEAL_SOURCES).optional(),
      lead_kind: z.enum(CRM_LEAD_KINDS).optional(),
      form_channel: z.enum(CRM_FORM_CHANNELS).optional(),
      form_answers: z.record(z.string().max(80), z.string().max(200)).optional(),
      searchId: z.string().optional(),
    })
    .optional(),
});

function clippedOptional(max: number) {
  return z.preprocess((value) => {
    if (value == null || value === "") return undefined;
    const text = String(value).trim().slice(0, max);
    return text || undefined;
  }, z.string().max(max).optional());
}

export const importLeadRowSchema = z.object({
  company: clippedOptional(120),
  name: clippedOptional(80),
  phone: clippedOptional(400),
  email: clippedOptional(400),
  cnpj: clippedOptional(32),
  notes: clippedOptional(4000),
  people: clippedOptional(2000),
  website: clippedOptional(300),
  instagram: clippedOptional(300),
  address: clippedOptional(400),
  kind: z.enum(CRM_LEAD_KINDS).optional(),
});

export const crmImportSchema = z
  .object({
    pipeline_id: z.string().uuid().optional(),
    pipeline_nome: pipelineNameSchema.optional(),
    file_name: clippedOptional(200),
    qualify: z.boolean().optional(),
    rows: z.array(importLeadRowSchema).min(1).max(IMPORT_MAX_ROWS),
  })
  .refine((value) => Boolean(value.pipeline_id || value.pipeline_nome), {
    message: "Escolha ou crie o nicho.",
  });

export function importSchemaError(error: z.ZodError): string {
  const issues = error.issues;
  if (issues.some((issue) => issue.path[0] === "rows" && issue.code === "too_big")) {
    return `Envie até ${IMPORT_MAX_ROWS} linhas.`;
  }
  if (issues.some((issue) => issue.path[0] === "rows" && issue.code === "too_small")) {
    return "Envie pelo menos uma linha.";
  }
  if (
    issues.some(
      (issue) =>
        issue.message === "Escolha ou crie o nicho." ||
        issue.path[0] === "pipeline_id" ||
        issue.path[0] === "pipeline_nome",
    )
  ) {
    return "Escolha ou crie o nicho.";
  }
  return issues[0]?.message ?? "Não foi possível importar.";
}

export const crmInboundCreateSchema = z.object({
  nome: pipelineNameSchema,
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid().nullable().optional(),
  lead_kind: z.enum(CRM_LEAD_KINDS),
  channel: z.enum(CRM_FORM_CHANNELS),
});

export const crmInboundPatchSchema = z.object({
  nome: pipelineNameSchema.optional(),
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().nullable().optional(),
  lead_kind: z.enum(CRM_LEAD_KINDS).optional(),
  channel: z.enum(CRM_FORM_CHANNELS).optional(),
  rotate: z.boolean().optional(),
});

export const dealPatchSchema = z.object({
  company_name: z.string().trim().min(1).max(120).optional(),
  contact_name: z.string().trim().max(80).optional(),
  secretaries: z.array(z.string().trim().max(80)).max(8).optional(),
  people: z.array(crmPersonSchema).max(12).optional(),
  phones: z.array(z.string().trim().max(24)).max(8).optional(),
  notes: z.string().max(4000).optional(),
  cnpj: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null || value === "") return undefined;
      const digits = value.replace(/\D/g, "");
      if (!digits) return undefined;
      return digits.padStart(14, "0");
    })
    .refine((value) => value === undefined || /^\d{14}$/.test(value), {
      message: "CNPJ inválido",
    }),
  amount_cents: z
    .number()
    .int()
    .min(0)
    .max(MAX_DEAL_AMOUNT_CENTS)
    .nullable()
    .optional(),
});

export const dealMoveSchema = z.object({
  stageId: z.string().uuid(),
  position: z.number().int().min(0).max(9999),
});

export const activityKindSchema = z.enum(CRM_ACTIVITY_KINDS);

export const scheduleSchema = z.object({
  kind: activityKindSchema,
  dueAt: z.string().min(10).max(40),
  activityId: z.string().uuid().optional(),
});

export const completeSchema = z.object({
  activityId: z.string().uuid(),
});

export const logCallSchema = z.object({
  notes: z.string().max(4000),
  next: scheduleSchema.nullable().optional(),
  phone: z.string().trim().max(24).optional(),
});

export const eventKindSchema = z.enum(CRM_EVENT_KINDS);

export const eventCreateSchema = z.object({
  kind: eventKindSchema,
  body: z.string().max(4000).optional(),
  phone: z.string().trim().max(24).optional(),
  next: scheduleSchema.nullable().optional(),
});

export const eventPatchSchema = z.object({
  body: z.string().max(4000),
});

export const outcomeSchema = z.object({
  outcome: z.enum(CRM_OUTCOMES),
});

export const dealSearchQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  pipeline: z.string().uuid().optional(),
});

export const DEAL_CNPJ_LOOKUP_MAX = 50;

export const dealCnpjsQuerySchema = z.string().transform((value) => {
  const seen: string[] = [];
  const used = new Set<string>();
  for (const part of value.split(",")) {
    const rawDigits = part.replace(/\D/g, "");
    if (!rawDigits) continue;
    const digits = rawDigits.padStart(14, "0");
    if (!/^\d{14}$/.test(digits) || used.has(digits)) continue;
    used.add(digits);
    seen.push(digits);
    if (seen.length >= DEAL_CNPJ_LOOKUP_MAX) break;
  }
  return seen;
});

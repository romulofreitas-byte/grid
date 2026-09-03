import { z } from "zod";
import { CRM_ACTIVITY_KINDS, CRM_EVENT_KINDS, CRM_OUTCOMES } from "@/lib/crm/types";

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
  meta: z
    .object({
      source: z.enum(["qualify_bridge", "catchup_bridge", "crm_add"]).optional(),
    })
    .optional(),
});

export const dealPatchSchema = z.object({
  company_name: z.string().trim().min(1).max(120).optional(),
  contact_name: z.string().trim().max(80).optional(),
  secretaries: z.array(z.string().trim().max(80)).max(8).optional(),
  people: z.array(crmPersonSchema).max(12).optional(),
  phones: z.array(z.string().trim().max(24)).max(8).optional(),
  notes: z.string().max(4000).optional(),
});

export const dealMoveSchema = z.object({
  stageId: z.string().uuid(),
  position: z.number().int().min(0).max(9999),
});

export const activityKindSchema = z.enum(CRM_ACTIVITY_KINDS);

export const scheduleSchema = z.object({
  kind: activityKindSchema,
  dueAt: z.string().min(10).max(40),
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

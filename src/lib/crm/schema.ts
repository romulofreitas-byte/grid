import { z } from "zod";
import { CRM_ACTIVITY_KINDS } from "@/lib/crm/types";

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
});

export const dealPatchSchema = z.object({
  company_name: z.string().trim().min(1).max(120).optional(),
  contact_name: z.string().trim().max(80).optional(),
  secretaries: z.array(z.string().trim().max(80)).max(8).optional(),
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
});

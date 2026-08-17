import type { LeadStatus } from "@/lib/types";
import { inboundOutcomeSchema, type InboundOutcome } from "./schema";

/**
 * Canonical dispositions (normalized: lowercase, no accents, `_` for spaces).
 * Unknown values return null so GRID does not clobber saved_leads.status.
 */
const DISPOSITION_TO_STATUS: Record<string, LeadStatus> = {
  novo: "novo",
  new: "novo",
  reset: "novo",

  ligando: "ligando",
  calling: "ligando",
  answered: "ligando",
  atendeu: "ligando",
  connected: "ligando",
  no_answer: "ligando",
  nao_atendeu: "ligando",
  busy: "ligando",
  ocupado: "ligando",
  voicemail: "ligando",
  caixa_postal: "ligando",
  callback: "ligando",
  retornar: "ligando",
  retry: "ligando",

  reuniao: "reuniao",
  meeting: "reuniao",
  agendou: "reuniao",
  scheduled: "reuniao",
  appointment: "reuniao",

  descartado: "descartado",
  not_interested: "descartado",
  sem_interesse: "descartado",
  nao_perturbe: "descartado",
  dnc: "descartado",
  do_not_call: "descartado",
  wrong_number: "descartado",
  numero_errado: "descartado",
  invalid: "descartado",
};

export function normalizeDisposition(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-/]+/g, "_");
}

export function dispositionToLeadStatus(raw: string): LeadStatus | null {
  return DISPOSITION_TO_STATUS[normalizeDisposition(raw)] ?? null;
}

export type ParsedInboundOutcome = {
  body: InboundOutcome;
  status: LeadStatus | null;
};

export function parseInboundOutcome(json: unknown): ParsedInboundOutcome {
  const body = inboundOutcomeSchema.parse(json);
  return { body, status: dispositionToLeadStatus(body.disposition) };
}

import type { CrmFormFields, CrmFormQuestion } from "@/lib/crm/types";

const QUESTION_MAX = 8;
const LABEL_MAX = 80;

export function parseFormFields(raw: unknown): CrmFormFields {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const questions = Array.isArray(rec.questions)
    ? rec.questions
        .map(parseQuestion)
        .filter((q): q is CrmFormQuestion => Boolean(q))
        .slice(0, QUESTION_MAX)
    : [];
  return {
    company: rec.company === true,
    cnpj: rec.cnpj === true,
    questions,
  };
}

function parseQuestion(raw: unknown): CrmFormQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const label = typeof rec.label === "string" ? rec.label.trim().slice(0, LABEL_MAX) : "";
  if (!label) return null;
  const id =
    typeof rec.id === "string" && rec.id.trim()
      ? rec.id.trim().slice(0, 40)
      : slugQuestion(label);
  return { id, label };
}

function slugQuestion(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "pergunta";
}

export function answersFromFormBody(
  fields: CrmFormFields,
  body: Record<string, unknown>,
): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of fields.questions ?? []) {
    const value = body[question.id];
    if (typeof value === "string" && value.trim()) {
      answers[question.label] = value.trim().slice(0, 200);
    }
  }
  return answers;
}

export const DEFAULT_CADENCE = [
  "Entrada de Lista",
  "Tentando Contato",
  "Contato Respondido",
  "Follow UP Decisor",
  "Reunião Agendada",
  "Reunião Realizada (R1)",
  "Ajustando Proposta",
  "Proposta Apresentada (R2)",
  "Negociação e Fechamento",
  "Contrato fechado",
] as const;

export const DEFAULT_PIPELINE_NAME = "Meu nicho";

export function cloneDefaultCadence(): string[] {
  return [...DEFAULT_CADENCE];
}

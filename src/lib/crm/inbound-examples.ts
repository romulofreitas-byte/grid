import type { CrmFormChannel } from "@/lib/crm/types";

export const INBOUND_COMPANY_EXAMPLE = {
  kind: "company",
  company: "Roal Indústria Metalúrgica Ltda",
  name: "Maria Silva",
  phone: "5432892400",
  email: "maria@roal.com.br",
  cnpj: "00000000000191",
  notes: "Formulário do site",
  answers: {
    volume: "Acima de 10 t",
    prazo: "90 dias",
  },
} as const;

export const INBOUND_PERSON_EXAMPLE = {
  kind: "person",
  name: "João da Silva",
  phone: "11981887766",
  email: "joao@gmail.com",
  answers: {
    "Qual plano?": "Ouro",
    CPF: "000.000.000-00",
    cargo: "Autônomo",
  },
} as const;

export function formAnswersTitle(channel?: CrmFormChannel): string {
  return channel === "ads" ? "Respostas do anúncio" : "Respostas do formulário";
}

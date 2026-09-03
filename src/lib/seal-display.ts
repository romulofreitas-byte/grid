import type { ContactSeal } from "@/lib/types";

export type ContactSealType = ContactSeal;

export function sealLabel(seal: ContactSeal, qtdEmpresas = 0): string {
  switch (seal) {
    case "CONFIRMADO":
      return "Confere com o site oficial";
    case "ATUALIZADO":
      return "Número atualizado pelo site da empresa";
    case "COMPARTILHADO":
      return `Este número aparece em ${qtdEmpresas} empresas — provavelmente é do escritório, não da empresa`;
    case "GRUPO":
      return `Mesmo telefone em ${qtdEmpresas} empresas do grupo`;
    case "NAO_CONFIRMADO":
    default:
      return "não verificado";
  }
}

export function sealDisplay(seal: ContactSeal): {
  colorClass: string;
  title: string;
} {
  switch (seal) {
    case "CONFIRMADO":
      return { colorClass: "text-podium-success", title: "Confirmado" };
    case "ATUALIZADO":
      return { colorClass: "text-podium-yellow", title: "Do site" };
    case "COMPARTILHADO":
      return { colorClass: "text-amber-400", title: "Contabilidade" };
    case "GRUPO":
      return { colorClass: "text-sky-400", title: "Grupo" };
    case "NAO_CONFIRMADO":
    default:
      return { colorClass: "text-podium-muted", title: "Não verificado" };
  }
}

export function sealCsvLabel(seal: ContactSeal): string {
  switch (seal) {
    case "CONFIRMADO":
      return "Confirmado";
    case "ATUALIZADO":
      return "Atualizado";
    case "COMPARTILHADO":
      return "Contabilidade — provável escritório";
    case "GRUPO":
      return "Grupo econômico";
    case "NAO_CONFIRMADO":
      return "Não confirmado";
  }
}

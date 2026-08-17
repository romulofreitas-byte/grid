import ExcelJS from "exceljs";
import type { LeadDossier, PhoneEvidence } from "@/lib/types";
import { formatCnpj, formatPhone } from "@/lib/format";
import { sealCsvLabel } from "@/lib/contact-confidence";

function exportablePhones(lead: LeadDossier): PhoneEvidence[] {
  return (lead.enrichment?.phones ?? []).filter((p) =>
    p.sources.some((s) => s !== "osm"),
  );
}

export function exportPhoneColumns(lead: LeadDossier): {
  principal: string;
  receita: string;
  site: string;
  whatsapp: string;
} {
  const primary = lead.contacts[0];
  const principal =
    formatPhone(primary?.ddd ?? null, primary?.telefone ?? null) ?? "";
  const evidences = exportablePhones(lead);

  const receitaEv = evidences.find((p) => p.sources.includes("receita"));
  const siteEv = evidences.find((p) =>
    p.sources.some((s) => s.startsWith("site")),
  );

  const receitaFromContacts = lead.contacts.find((c) => c.source === "receita");
  const siteFromContacts = lead.contacts.find((c) => c.source === "site");
  const useContactsFallback = evidences.length === 0;

  const receita =
    receitaEv?.display ??
    (useContactsFallback
      ? formatPhone(
          receitaFromContacts?.ddd ?? null,
          receitaFromContacts?.telefone ?? null,
        ) ?? ""
      : "");
  const site =
    siteEv?.display ??
    (useContactsFallback
      ? formatPhone(
          siteFromContacts?.ddd ?? null,
          siteFromContacts?.telefone ?? null,
        ) ?? ""
      : "");

  const waEvidence = evidences.find((p) => p.isWhatsApp);
  const whatsapp =
    lead.enrichment?.whatsapp?.replace(/^55/, "") ?? waEvidence?.display ?? "";

  return { principal, receita, site, whatsapp };
}

export async function buildXlsx(
  leads: LeadDossier[],
  meta: { nome: string; total: number; created_at: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const grid = wb.addWorksheet("Grid");
  const resumo = wb.addWorksheet("Resumo da busca");

  grid.addRow([
    "Posição",
    "Empresa",
    "Nome Fantasia",
    "CNPJ",
    "Contato",
    "Cargo",
    "Telefone Principal",
    "Confianca",
    "Telefone Receita",
    "Telefone Site",
    "Whatsapp",
    "Email",
    "Site",
    "Cidade",
    "UF",
    "Score",
  ]);
  const header = grid.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B1A2E" },
  };
  grid.getRow(1).eachCell((cell) => {
    cell.border = {
      bottom: { style: "medium", color: { argb: "FFF5B301" } },
    };
  });
  grid.views = [{ state: "frozen", ySplit: 1 }];
  grid.autoFilter = { from: "A1", to: "P1" };

  leads.forEach((l) => {
    const primary = l.contacts[0];
    const cols = exportPhoneColumns(l);
    const row = grid.addRow([
      l.gridPosition,
      l.company.razao_social,
      l.establishment.nome_fantasia ?? "",
      formatCnpj(l.establishment.cnpj),
      l.decisor?.nome ?? "",
      l.decisor?.qualificacao ?? "",
      cols.principal,
      primary ? sealCsvLabel(primary.seal) : "Nao confirmado",
      cols.receita,
      cols.site,
      cols.whatsapp,
      l.emailSeal.email ?? "",
      l.enrichment?.domain ?? "",
      l.municipioNome,
      l.establishment.uf,
      l.gridScore,
    ]);
    if (primary?.seal === "COMPARTILHADO") {
      const cell = row.getCell(7);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFBBF24" },
      };
      cell.note = `Este número aparece em ${primary.sharedCount} empresas — provavelmente é do escritório, não da empresa`;
    }
  });

  grid.columns.forEach((col) => {
    col.width = 18;
  });

  resumo.addRow(["Busca", meta.nome]);
  resumo.addRow(["Data", meta.created_at]);
  resumo.addRow(["Total", meta.total]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildCsv(leads: LeadDossier[]): string {
  const header = [
    "Empresa",
    "Nome Fantasia",
    "CNPJ",
    "Contato",
    "Cargo",
    "Telefone Principal",
    "Confianca",
    "Telefone Receita",
    "Telefone Site",
    "Whatsapp",
    "Email",
    "Site",
    "Endereco",
    "Bairro",
    "Cidade",
    "Estado",
    "CEP",
    "Setor",
    "Porte",
    "Origem",
    "Score",
    "Observacoes",
  ];
  const lines = [header.join(";")];
  for (const l of leads) {
    const primary = l.contacts[0];
    const cols = exportPhoneColumns(l);
    lines.push(
      [
        l.company.razao_social,
        l.establishment.nome_fantasia ?? "",
        formatCnpj(l.establishment.cnpj),
        l.decisor?.nome ?? "",
        l.decisor?.qualificacao ?? "",
        cols.principal,
        primary ? sealCsvLabel(primary.seal) : "Nao confirmado",
        cols.receita,
        cols.site,
        cols.whatsapp,
        l.emailSeal.email ?? "",
        l.enrichment?.domain ?? "",
        [l.establishment.logradouro, l.establishment.numero].filter(Boolean).join(", "),
        l.establishment.bairro ?? "",
        l.municipioNome,
        l.establishment.uf,
        l.establishment.cep ?? "",
        l.cnaeDescricao,
        l.company.porte ?? "",
        "GRID - Mundo Podium",
        String(l.gridScore),
        l.notas ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { LeadDossier, SearchFilters } from "@/lib/types";
import { formatPhone, formatPorte } from "@/lib/format";
import { sealCsvLabel } from "@/lib/contact-confidence";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { listSummaryBadges } from "@/lib/filter-summary";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0B1A2E",
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: "#F5B301",
    paddingBottom: 10,
  },
  brand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0B1A2E",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 9,
    color: "#7A8494",
  },
  badgeRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  badge: {
    borderWidth: 1,
    borderColor: "#C5CDD8",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    color: "#12263F",
  },
  row: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#C5CDD8",
  },
  position: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#F5B301",
    marginBottom: 2,
  },
  company: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  line: {
    marginTop: 2,
    color: "#12263F",
  },
  muted: {
    color: "#7A8494",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#7A8494",
  },
});

export type PdfListMeta = {
  nome: string;
  total: number;
  created_at: string;
  filters?: SearchFilters;
  segmentNames?: Record<string, string>;
};

function GridPdfDocument({
  leads,
  meta,
}: {
  leads: LeadDossier[];
  meta: PdfListMeta;
}) {
  const badges = meta.filters
    ? listSummaryBadges(meta.filters, {
        segmentNames: meta.segmentNames,
        includeSemContabil: true,
      })
    : [];

  return (
    <Document
      title={meta.nome || "GRID"}
      author="GRID · Mundo Pódium"
      subject="Lista de prospecção"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>GRID · Mundo Pódium</Text>
          <Text style={styles.subtitle}>
            {meta.nome || "Lista"} · {leads.length} de {meta.total} leads ·{" "}
            {meta.created_at.slice(0, 10)}
          </Text>
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((b) => (
                <Text key={b.key} style={styles.badge}>
                  {b.label}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {leads.map((lead, i) => {
          const contact = lead.contacts[0];
          const tel = contact
            ? formatPhone(contact.ddd, contact.telefone) ?? "NÃO ENCONTRADO"
            : "NÃO ENCONTRADO";
          const seal = contact ? sealCsvLabel(contact.seal) : "";
          const name = displayCompanyName(
            lead.establishment.nome_fantasia,
            lead.company.razao_social,
          );
          const porte = formatPorte(lead.company.porte);
          const email = lead.emailSeal?.email;
          return (
            <View key={lead.establishment.cnpj} style={styles.row} wrap={false}>
              <Text style={styles.position}>
                P{lead.gridPosition ?? i + 1} · score {lead.gridScore}
              </Text>
              <Text style={styles.company}>{name}</Text>
              <Text style={styles.line}>
                Decisor: {lead.decisor?.nome ?? "NÃO ENCONTRADO"}
                {lead.decisor?.qualificacao
                  ? ` · ${lead.decisor.qualificacao}`
                  : ""}
              </Text>
              <Text style={styles.line}>
                Tel: {tel}
                {seal ? ` · ${seal}` : ""}
              </Text>
              {email ? (
                <Text style={styles.line}>E-mail: {email}</Text>
              ) : null}
              <Text style={[styles.line, styles.muted]}>
                {lead.municipioNome}/{lead.establishment.uf} ·{" "}
                {lead.cnaeDescricao || "NÃO ENCONTRADO"}
                {porte !== "NÃO ENCONTRADO" ? ` · ${porte}` : ""}
              </Text>
            </View>
          );
        })}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `GRID · página ${pageNumber} de ${totalPages} · dados da Receita Federal + qualificação do piloto`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function buildPdf(
  leads: LeadDossier[],
  meta: PdfListMeta,
): Promise<Buffer> {
  const instance = pdf(<GridPdfDocument leads={leads} meta={meta} />);
  const result = await instance.toBuffer();
  if (Buffer.isBuffer(result)) return result;
  if (result instanceof Uint8Array) return Buffer.from(result);
  // @react-pdf v4 may return a Node Readable / Web ReadableStream
  const stream = result as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

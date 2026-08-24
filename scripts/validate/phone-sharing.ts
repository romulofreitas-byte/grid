#!/usr/bin/env tsx
/**
 * Shared-phone hypothesis report.
 * Default: live Postgres via DATABASE_URL.
 * Pass `--allow-mock` to fall back to the in-memory store (labeled MOCK).
 */
import "../../src/lib/load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMockStore } from "../../src/lib/data/mock-store";
import { CONTACT_RULES } from "../../src/lib/contact-confidence";
import type { SharedPhoneVerdict } from "../../src/lib/types";

type PhoneRow = {
  ddd1: string;
  telefone1: string;
  qtd_empresas: number;
  verdict: SharedPhoneVerdict;
};

type SampleCompany = {
  razao: string;
  municipio: string;
  uf: string;
  cnae: string;
};

const BUCKETS = [
  { label: "1", test: (n: number) => n === 1 },
  { label: "2", test: (n: number) => n === 2 },
  { label: "3", test: (n: number) => n === 3 },
  { label: "4-5", test: (n: number) => n >= 4 && n <= 5 },
  { label: "6-10", test: (n: number) => n >= 6 && n <= 10 },
  { label: "11-50", test: (n: number) => n >= 11 && n <= 50 },
  { label: "50+", test: (n: number) => n > 50 },
] as const;

function formatPhone(ddd: string, tel: string): string {
  if (tel.length === 9) return `(${ddd}) ${tel.slice(0, 5)}-${tel.slice(5)}`;
  if (tel.length === 8) return `(${ddd}) ${tel.slice(0, 4)}-${tel.slice(4)}`;
  return `(${ddd}) ${tel}`;
}

async function fromPostgres(): Promise<{
  rows: PhoneRow[];
  samples: Map<string, SampleCompany[]>;
} | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: url });
    await client.connect();
    const verdict = await client.query<PhoneRow>(
      `select ddd1, telefone1, qtd_empresas, verdict::text as verdict
       from phone_shared_verdict`,
    );
    const sample = await client.query<{
      ddd1: string;
      telefone1: string;
      razao: string;
      municipio: string;
      uf: string;
      cnae: string;
    }>(
      `select e.ddd1, e.telefone1, c.razao_social as razao,
              m.nome as municipio, e.uf, coalesce(rc.descricao, e.cnae_principal) as cnae
       from establishments e
       join companies c on c.cnpj_basico = e.cnpj_basico
       left join ref_municipio m on m.id = e.municipio_id
       left join ref_cnae rc on rc.codigo = e.cnae_principal
       where e.telefone1 is not null`,
    );
    await client.end();
    const samples = new Map<string, SampleCompany[]>();
    for (const r of sample.rows) {
      const key = `${r.ddd1}|${r.telefone1}`;
      const list = samples.get(key) ?? [];
      if (list.length < 10) {
        list.push({
          razao: r.razao,
          municipio: r.municipio,
          uf: r.uf,
          cnae: r.cnae,
        });
      }
      samples.set(key, list);
    }
    return { rows: verdict.rows, samples };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "phone_sharing_pg_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

function fromMock(): {
  rows: PhoneRow[];
  samples: Map<string, SampleCompany[]>;
} {
  const store = getMockStore();
  const samples = new Map<string, SampleCompany[]>();
  for (const e of store.establishments) {
    if (!e.ddd1 || !e.telefone1) continue;
    const key = `${e.ddd1}|${e.telefone1}`;
    const list = samples.get(key) ?? [];
    if (list.length < 10) {
      const company = store.companies.find((c) => c.cnpj_basico === e.cnpj_basico);
      const mun = store.ref_municipio.find((m) => m.id === e.municipio_id);
      const cnae = store.ref_cnae.find((c) => c.codigo === e.cnae_principal);
      list.push({
        razao: company?.razao_social ?? "NÃO ENCONTRADO",
        municipio: mun?.nome ?? "NÃO ENCONTRADO",
        uf: e.uf,
        cnae: cnae?.descricao ?? e.cnae_principal,
      });
    }
    samples.set(key, list);
  }
  return { rows: store.phone_verdict, samples };
}

function renderReport(
  source: "mock" | "supabase",
  rows: PhoneRow[],
  samples: Map<string, SampleCompany[]>,
): string {
  const totalPhones = rows.length;
  const dist = BUCKETS.map((b) => ({
    label: b.label,
    count: rows.filter((r) => b.test(r.qtd_empresas)).length,
  }));
  const shared = rows.filter(
    (r) => r.qtd_empresas >= CONTACT_RULES.sharedPhoneThreshold,
  );
  const grupo = [...shared.filter((r) => r.verdict === "grupo_economico")].sort(
    (a, b) => b.qtd_empresas - a.qtd_empresas,
  );
  const conta = shared.filter((r) => r.verdict === "contabilidade");
  const top = [...rows].sort((a, b) => b.qtd_empresas - a.qtd_empresas).slice(0, 50);

  const banner =
    source === "mock"
      ? [
          "> **MOCK — ingestão MG/SP da Receita não foi executada.**",
          "> Não há `DATABASE_URL` com a base real. Os números abaixo vêm do store",
          "> sintético (5.000 estabelecimentos). O limiar de 3 CNPJs **não está**",
          "> validado contra dado real. Rode de novo depois de `pnpm ingest --ufs=MG,SP`.",
          "",
        ].join("\n")
      : [
          "> Fonte: materialized view `phone_shared_verdict` no Postgres ligado.",
          "",
        ].join("\n");

  const distTable = [
    "| CNPJs por telefone | Quantidade de telefones |",
    "| --- | ---: |",
    ...dist.map((d) => `| ${d.label} | ${d.count} |`),
  ].join("\n");

  const topBlocks = top.map((r, i) => {
    const key = `${r.ddd1}|${r.telefone1}`;
    const firms = samples.get(key) ?? [];
    const lines = firms
      .map(
        (f) =>
          `  - ${f.razao} · ${f.municipio}/${f.uf} · ${f.cnae}`,
      )
      .join("\n");
    return [
      `### ${i + 1}. ${formatPhone(r.ddd1, r.telefone1)} — ${r.qtd_empresas} CNPJs · \`${r.verdict}\``,
      lines || "  - (sem amostra)",
      "",
    ].join("\n");
  });

  const grupoExample = grupo[0];
  const grupoKey = grupoExample
    ? `${grupoExample.ddd1}|${grupoExample.telefone1}`
    : "";
  const grupoFirms = grupoKey ? (samples.get(grupoKey) ?? []) : [];

  return [
    "# Relatório — telefones compartilhados",
    "",
    `Gerado em ${new Date().toISOString().slice(0, 10)}.`,
    "",
    banner,
    "## 1. Distribuição",
    "",
    `Total de números distintos: **${totalPhones}**.`,
    "",
    distTable,
    "",
    "## 2. Limiar recomendado",
    "",
    source === "mock"
      ? [
          `No mock, o corte atual de **${CONTACT_RULES.sharedPhoneThreshold} CNPJs** separa o`,
          "telefone do escritório (centenas de CNPJs, sócios disjuntos) do telefone",
          "próprio. **Não dá para recomendar 3, 4 ou 8 com esta amostra.** A hipótese",
          "central do produto continua não verificada contra MG/SP reais.",
        ].join(" ")
      : [
          `Telefones com ${CONTACT_RULES.sharedPhoneThreshold}+ CNPJs: **${shared.length}**.`,
          `Destes, **${conta.length}** saíram como contabilidade e **${grupo.length}** como grupo econômico.`,
          "Olhe a amostra dos 50 mais compartilhados antes de subir o corte.",
        ].join(" "),
    "",
    "## 3. Contabilidade × grupo econômico",
    "",
    `- Compartilhados (≥${CONTACT_RULES.sharedPhoneThreshold}): **${shared.length}**`,
    `- Verdict \`contabilidade\`: **${conta.length}**`,
    `- Verdict \`grupo_economico\`: **${grupo.length}**`,
    `- Selos que mudam com a regra de sócios: **${grupo.length}** telefones deixam de ser Contabilidade e passam a Grupo.`,
    "",
    grupoExample
      ? [
          "Caso demonstrado (mesmo sócio, vários CNPJs):",
          "",
          `- ${formatPhone(grupoExample.ddd1, grupoExample.telefone1)} em ${grupoExample.qtd_empresas} empresas`,
          ...grupoFirms.map((f) => `  - ${f.razao} · ${f.municipio}/${f.uf}`),
          "",
          source === "mock"
            ? "No mock este cluster é o intervalo de índices 200–207 (sócia Helena Vargas Silva, telefone 3222-1111)."
            : "Sócios em comum entre os CNPJs deste telefone — número tratado como grupo, não escritório.",
        ].join("\n")
      : "Nenhum grupo econômico encontrado nesta base.",
    "",
    "## 4. Falsos positivos previsíveis (checagem manual)",
    "",
    "Além de grupo econômico, a amostra dos 50 deve ser lida olhando para:",
    "",
    "- Rede de franquias com central de atendimento",
    "- Condomínio empresarial / shopping com telefone único",
    "- Call center terceirizado",
    "",
    "Esses casos **não** são separados automaticamente pela sobreposição de sócios.",
    "",
    "## 5. Amostra dos 50 telefones mais compartilhados",
    "",
    ...topBlocks,
    "",
  ].join("\n");
}

async function main() {
  const allowMock = process.argv.includes("--allow-mock");
  const live = await fromPostgres();
  if (!live && !allowMock) {
    console.error(
      JSON.stringify({
        event: "phone_sharing_requires_db",
        message:
          "DATABASE_URL ausente ou phone_shared_verdict indisponível. " +
          "Rode após ingest RF, ou passe --allow-mock para o store sintético.",
      }),
    );
    process.exit(1);
  }
  const source: "mock" | "supabase" = live ? "supabase" : "mock";
  const { rows, samples } = live ?? fromMock();
  const md = renderReport(source, rows, samples);
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "../../reports/phone-sharing.md");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md, "utf8");
  console.log(
    JSON.stringify({
      event: "phone_sharing_written",
      source,
      phones: rows.length,
      path: out,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

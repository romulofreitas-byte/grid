#!/usr/bin/env tsx
/**
 * Reports which niche segments resolve to 0 CNAEs or 0 establishments
 * against live `ref_cnae` + `cnae_uf_count`.
 *
 *   pnpm audit:segments
 *   pnpm audit:segments -- --ufs=MG,SP
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { getDatabaseUrl, parseArgs, REPO_ROOT } from "../ingest/config";
import {
  resolveCnaesFromKeywords,
  PRESET_SEED,
} from "../../src/lib/niches";

async function main() {
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is required (Postgres with ref_cnae).");
    process.exit(1);
  }
  const { ufs } = parseArgs(process.argv.slice(2));
  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url)
      ? undefined
      : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows: refRows } = await client.query<{
      codigo: string;
      descricao: string;
    }>("select codigo, descricao from ref_cnae");
    const refCnaes = refRows.map((r) => ({
      codigo: String(r.codigo).trim(),
      descricao: r.descricao,
    }));

    let countSql = `select cnae_principal, sum(n)::int as n from cnae_uf_count`;
    const countParams: unknown[] = [];
    if (ufs.length) {
      countParams.push(ufs);
      countSql += ` where uf = any($1::text[])`;
    }
    countSql += " group by 1";
    let counts = new Map<string, number>();
    try {
      const { rows } = await client.query<{ cnae_principal: string; n: number }>(
        countSql,
        countParams,
      );
      counts = new Map(rows.map((r) => [String(r.cnae_principal).trim(), Number(r.n)]));
    } catch {
      const { rows } = await client.query<{ cnae_principal: string; n: number }>(
        ufs.length
          ? `select cnae_principal, count(*)::int as n from establishments where uf = any($1::text[]) group by 1`
          : `select cnae_principal, count(*)::int as n from establishments group by 1`,
        ufs.length ? [ufs] : [],
      );
      counts = new Map(rows.map((r) => [String(r.cnae_principal).trim(), Number(r.n)]));
    }

    const segments = PRESET_SEED.filter((p) => p.parent_slug);
    const lines: string[] = [
      `# Cobertura de segmentos`,
      ``,
      `UFs: ${ufs.join(", ") || "todas"}. Gerado em ${new Date().toISOString().slice(0, 10)}.`,
      ``,
      `| Segmento | CNAEs | Empresas | Status |`,
      `|---|---:|---:|---|`,
    ];
    let emptyKw = 0;
    let emptyEst = 0;
    for (const seg of segments) {
      const matched = resolveCnaesFromKeywords(
        seg.keywords,
        seg.exclusoes,
        refCnaes,
      );
      const nEst = matched.reduce(
        (sum, c) => sum + (counts.get(c.codigo) ?? 0),
        0,
      );
      let status = "ok";
      if (!matched.length) {
        status = "0 CNAEs (keywords não batem no IBGE)";
        emptyKw += 1;
      } else if (nEst === 0) {
        status = "CNAEs sem estabelecimento na região";
        emptyEst += 1;
      }
      lines.push(
        `| ${seg.nome} (\`${seg.slug}\`) | ${matched.length} | ${nEst} | ${status} |`,
      );
    }
    lines.push(``);
    lines.push(
      `**Resumo:** ${segments.length} segmentos · ${emptyKw} sem CNAE · ${emptyEst} com CNAE mas 0 empresas.`,
    );
    const out = path.join(REPO_ROOT, "reports", "segment-coverage.md");
    writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
    console.log(`Wrote ${out}`);
    console.log(
      `${emptyKw} segmentos sem CNAE, ${emptyEst} sem empresas (${ufs.join(",") || "ALL"}).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

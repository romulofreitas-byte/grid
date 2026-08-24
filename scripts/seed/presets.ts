#!/usr/bin/env tsx
/**
 * Seed niche_presets from hierarchical PRESET_SEED (keywords only — no CNAE codes).
 * Inserts niches first, then segments with parent_id resolved by slug.
 */

import { getDatabaseUrl } from "../ingest/config";
import { PRESET_SEED } from "../../src/lib/niches";

const DATABASE_URL = getDatabaseUrl();

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function formatTextArray(values: string[]): string {
  if (!values.length) return "ARRAY[]::text[]";
  const items = values.map((v) => `'${escapeSqlString(v)}'`).join(", ");
  return `ARRAY[${items}]`;
}

function buildInsertStatements(): string[] {
  const niches = PRESET_SEED.filter((p) => !p.parent_slug);
  const segments = PRESET_SEED.filter((p) => p.parent_slug);
  const stmts: string[] = [
    "ALTER TABLE niche_presets ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}';",
  ];

  for (const preset of niches) {
    stmts.push(
      [
        "INSERT INTO niche_presets (slug, nome, grupo, perfil_score, parent_id, keywords, exclusoes, name_stems, aliases, curado, ordem)",
        "VALUES (",
        `  '${escapeSqlString(preset.slug)}',`,
        `  '${escapeSqlString(preset.nome)}',`,
        `  '${escapeSqlString(preset.grupo)}',`,
        `  '${escapeSqlString(preset.perfil_score)}',`,
        "  NULL,",
        `  ${formatTextArray(preset.keywords)},`,
        `  ${formatTextArray(preset.exclusoes)},`,
        `  ${formatTextArray(preset.name_stems)},`,
        `  ${formatTextArray(preset.aliases)},`,
        "  false,",
        `  ${preset.ordem}`,
        ")",
        "ON CONFLICT (slug) DO UPDATE SET",
        "  nome = EXCLUDED.nome,",
        "  keywords = EXCLUDED.keywords,",
        "  exclusoes = EXCLUDED.exclusoes,",
        "  name_stems = EXCLUDED.name_stems,",
        "  aliases = EXCLUDED.aliases,",
        "  ordem = EXCLUDED.ordem;",
      ].join("\n"),
    );
  }

  for (const preset of segments) {
    stmts.push(
      [
        "INSERT INTO niche_presets (slug, nome, grupo, perfil_score, parent_id, keywords, exclusoes, name_stems, aliases, curado, ordem)",
        "VALUES (",
        `  '${escapeSqlString(preset.slug)}',`,
        `  '${escapeSqlString(preset.nome)}',`,
        `  '${escapeSqlString(preset.grupo)}',`,
        `  '${escapeSqlString(preset.perfil_score)}',`,
        `  (SELECT id FROM niche_presets WHERE slug = '${escapeSqlString(preset.parent_slug!)}'),`,
        `  ${formatTextArray(preset.keywords)},`,
        `  ${formatTextArray(preset.exclusoes)},`,
        `  ${formatTextArray(preset.name_stems)},`,
        `  ${formatTextArray(preset.aliases)},`,
        "  false,",
        `  ${preset.ordem}`,
        ")",
        "ON CONFLICT (slug) DO UPDATE SET",
        "  nome = EXCLUDED.nome,",
        "  parent_id = EXCLUDED.parent_id,",
        "  keywords = EXCLUDED.keywords,",
        "  exclusoes = EXCLUDED.exclusoes,",
        "  name_stems = EXCLUDED.name_stems,",
        "  aliases = EXCLUDED.aliases,",
        "  ordem = EXCLUDED.ordem;",
      ].join("\n"),
    );
  }

  return stmts;
}

async function main() {
  const stmts = buildInsertStatements();
  console.log(`=== GRID niche seed (${PRESET_SEED.length} nodes) ===\n`);
  if (!DATABASE_URL) {
    console.log("DATABASE_URL unset — printing SQL:\n");
    console.log(stmts.join("\n\n"));
    return;
  }

  const { Client } = await import("pg");
  const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const sql of stmts) {
      await client.query(sql);
    }
    console.log(`Seeded ${PRESET_SEED.length} niche/segment rows.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

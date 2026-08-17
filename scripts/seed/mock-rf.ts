#!/usr/bin/env tsx
/**
 * Print summary of mock Receita Federal data used by GRID in dev/mock mode.
 *
 * Mock source: src/lib/data/mock-store.ts (built from PRESET_SEED + synthetic RF rows).
 *
 * Usage:
 *   pnpm seed:mock
 */

import { getMockStore } from "../../src/lib/data/mock-store";

function main(): void {
  const store = getMockStore();

  console.log("\n=== GRID Mock RF Data Summary ===\n");
  console.log("Source file: src/lib/data/mock-store.ts");
  console.log("Used when DATABASE_URL is unset — the Next.js app reads via mock-repo.ts.\n");

  console.log("--- Reference tables ---");
  console.log(`  ref_cnae:         ${store.ref_cnae.length}`);
  console.log(`  ref_municipio:    ${store.ref_municipio.length}`);
  console.log(`  ref_qualificacao: ${store.ref_qualificacao.length}`);

  console.log("\n--- Receita Federal core ---");
  console.log(`  companies:        ${store.companies.length}`);
  console.log(`  establishments:   ${store.establishments.length}`);
  console.log(`  partners:         ${store.partners.length}`);
  console.log(`  simples_nacional: ${store.simples_nacional.length}`);

  const ufs = [...new Set(store.establishments.map((e) => e.uf))].sort();
  const withPhone = store.establishments.filter((e) => e.telefone1).length;
  const active = store.establishments.filter((e) => e.situacao === "02").length;

  console.log("\n--- Establishment breakdown ---");
  console.log(`  UFs:              ${ufs.join(", ")}`);
  console.log(`  situacao=02:      ${active}`);
  console.log(`  with telefone1:   ${withPhone}`);

  console.log("\n--- Contact sharing views (mock) ---");
  console.log(`  phone_usage:      ${store.phone_usage.length} distinct phones`);
  console.log(`  email_usage:      ${store.email_usage.length} distinct emails`);
  console.log(`  address_usage:    ${store.address_usage.length} distinct addresses`);

  const topPhones = [...store.phone_usage]
    .sort((a, b) => b.qtd_empresas - a.qtd_empresas)
    .slice(0, 3);
  if (topPhones.length) {
    console.log("\n  Top shared phones:");
    for (const p of topPhones) {
      console.log(`    (${p.ddd1}) ${p.telefone1} → ${p.qtd_empresas} empresas`);
    }
  }

  console.log("\n--- Niche presets ---");
  console.log(`  niche_presets:    ${store.niche_presets.length}`);

  console.log("\n--- How to load real RF data ---");
  console.log("  1. Set RF_CNPJ_BASE_URL if the Receita path changed (Jan/2026+)");
  console.log("  2. Download zips into scripts/ingest/data/");
  console.log("  3. pnpm ingest --dry-run --ufs=MG,SP");
  console.log("  4. Set DATABASE_URL and run: pnpm ingest --ufs=MG,SP");
  console.log("  5. pnpm seed:presets\n");
}

main();

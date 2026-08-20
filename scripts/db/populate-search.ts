#!/usr/bin/env tsx
/**
 * Populate establishments_search (post-ingest / post-restore).
 *
 *   pnpm db:populate-search
 *
 * Inserts one UF at a time (commit per UF) so a dropped client does not
 * throw away hours of work. Skips UFs already loaded (resume-safe).
 * Prefer SUPABASE_DB_URL (direct :5432) over the pooler.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_UFS, getDatabaseUrl, REPO_ROOT } from "../ingest/config";

const INSERT_SQL = `
insert into establishments_search (
  cnpj, cnpj_basico, razao_social, nome_fantasia, cnae_principal, uf, municipio_id,
  is_matriz, data_inicio, porte, capital_social, opcao_simples, telefone1, ddd1, email,
  phone_verdict, email_livre, email_proprio, endereco_compartilhado, tem_decisor, opted_out
)
select
  e.cnpj, e.cnpj_basico, c.razao_social, e.nome_fantasia, e.cnae_principal, e.uf, e.municipio_id,
  e.is_matriz, e.data_inicio, c.porte, c.capital_social, coalesce(s.opcao_simples, false),
  e.telefone1, e.ddd1, e.email, coalesce(pv.verdict, 'proprio'),
  (
    e.email is not null and e.email like '%@%' and (
      lower(split_part(e.email, '@', 2)) like '%gmail%'
      or lower(split_part(e.email, '@', 2)) like '%hotmail%'
      or lower(split_part(e.email, '@', 2)) like '%outlook%'
      or lower(split_part(e.email, '@', 2)) like '%yahoo%'
      or lower(split_part(e.email, '@', 2)) like '%uol%'
      or lower(split_part(e.email, '@', 2)) like '%bol%'
      or lower(split_part(e.email, '@', 2)) like '%terra%'
      or lower(split_part(e.email, '@', 2)) like '%ig.com%'
      or lower(split_part(e.email, '@', 2)) like '%live.com%'
    )
  ),
  (
    e.email is not null and e.email like '%@%' and not (
      lower(split_part(e.email, '@', 2)) like '%gmail%'
      or lower(split_part(e.email, '@', 2)) like '%hotmail%'
      or lower(split_part(e.email, '@', 2)) like '%outlook%'
      or lower(split_part(e.email, '@', 2)) like '%yahoo%'
      or lower(split_part(e.email, '@', 2)) like '%uol%'
      or lower(split_part(e.email, '@', 2)) like '%bol%'
      or lower(split_part(e.email, '@', 2)) like '%terra%'
      or lower(split_part(e.email, '@', 2)) like '%ig.com%'
      or lower(split_part(e.email, '@', 2)) like '%live.com%'
    )
    and lower(split_part(e.email, '@', 2)) not similar to '%(contab|contabil|assessoria|escritorio|fiscal|tributar)%'
  ),
  coalesce(au.qtd_empresas, 0) >= 5,
  pb.cnpj_basico is not null,
  exists (select 1 from opt_outs o where o.documento in (e.cnpj, e.cnpj_basico))
from establishments e
inner join companies c on c.cnpj_basico = e.cnpj_basico
left join simples_nacional s on s.cnpj_basico = e.cnpj_basico
left join phone_shared_verdict pv on pv.ddd1 = e.ddd1 and pv.telefone1 = e.telefone1
left join address_usage au
  on au.cep = e.cep and au.logradouro = e.logradouro and au.numero = e.numero
left join _es_partner_basicos pb on pb.cnpj_basico = e.cnpj_basico
where e.uf = $1
on conflict (cnpj) do nothing
`;

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function isPooler(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.port === "6543" || parsed.hostname.includes("pooler");
  } catch {
    return false;
  }
}

function resolveUrl(): string {
  const pooler = getDatabaseUrl();
  const direct = process.env.SUPABASE_DB_URL?.trim();
  if (pooler && isPooler(pooler) && direct) {
    console.log("Using SUPABASE_DB_URL (direct) instead of pooler DATABASE_URL.");
    return direct;
  }
  if (!pooler) throw new Error("DATABASE_URL is not set (check .env.local).");
  if (isPooler(pooler)) {
    console.warn(
      "WARN: DATABASE_URL looks like the pooler. Long jobs often die with ECONNRESET.",
    );
  }
  return pooler;
}

async function connect(url: string) {
  const { Client } = await import("pg");
  const local = isLocalHost(url);
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis: 30_000,
  });
  client.on("error", (err) => {
    console.error("pg client error:", err.message);
  });
  await client.connect();
  await client.query("set statement_timeout = 0");
  await client.query("set idle_in_transaction_session_timeout = 0");
  await client.query("set lock_timeout = 0");
  return client;
}

async function main(): Promise<void> {
  const url = resolveUrl();
  const fresh = process.argv.includes("--fresh");
  let client = await connect(url);

  try {
    const migration = readFileSync(
      path.join(REPO_ROOT, "supabase/migrations/20260824000000_establishments_search.sql"),
      "utf8",
    );
    console.log("Applying establishments_search migration...");
    await client.query(migration);

    console.log("Dropping search indexes...");
    await client.query(`
      drop index if exists idx_es_cnae_uf_mun;
      drop index if exists idx_es_uf_mun_cnae;
      drop index if exists idx_es_basico;
      drop index if exists idx_es_matriz;
      drop index if exists idx_es_fantasia;
      drop index if exists idx_es_razao;
    `);

    if (fresh) {
      console.log("Truncating establishments_search (--fresh)...");
      await client.query("truncate establishments_search");
    }

    console.log("Building partner lookup...");
    await client.query(`
      create unlogged table if not exists _es_partner_basicos (
        cnpj_basico char(8) primary key
      );
      truncate _es_partner_basicos;
      insert into _es_partner_basicos
      select distinct cnpj_basico from partners;
    `);

    const loaded = await client.query<{ uf: string; n: number }>(
      `select uf, count(*)::int as n from establishments_search group by uf`,
    );
    const done = new Map(loaded.rows.map((r) => [r.uf.trim(), Number(r.n)]));
    if (done.size) {
      console.log(
        `Already loaded: ${[...done.entries()].map(([uf, n]) => `${uf}=${n.toLocaleString()}`).join(", ")}`,
      );
    }

    const started = Date.now();
    let totalInserted = 0;
    for (const uf of ALL_UFS) {
      const existing = done.get(uf) ?? 0;
      if (existing > 0) {
        console.log(`skip ${uf} (${existing.toLocaleString()} rows)`);
        totalInserted += existing;
        continue;
      }
      console.log(`insert ${uf}...`);
      const t0 = Date.now();
      try {
        const res = await client.query(INSERT_SQL, [uf]);
        const n = res.rowCount ?? 0;
        totalInserted += n;
        console.log(
          `  ${uf} +${n.toLocaleString()} in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
        );
      } catch (err) {
        console.error(`  ${uf} failed, reconnecting:`, err instanceof Error ? err.message : err);
        try {
          await client.end();
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 3000));
        client = await connect(url);
        const res = await client.query(INSERT_SQL, [uf]);
        const n = res.rowCount ?? 0;
        totalInserted += n;
        console.log(
          `  ${uf} retry +${n.toLocaleString()} in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
        );
      }
    }

    console.log("Recreating indexes...");
    await client.query(`
      create index if not exists idx_es_cnae_uf_mun
        on establishments_search (cnae_principal, uf, municipio_id);
      create index if not exists idx_es_uf_mun_cnae
        on establishments_search (uf, municipio_id, cnae_principal);
      create index if not exists idx_es_basico
        on establishments_search (cnpj_basico);
      create index if not exists idx_es_matriz
        on establishments_search (is_matriz)
        where is_matriz;
      create index if not exists idx_es_fantasia
        on establishments_search using gin (nome_fantasia gin_trgm_ops);
      create index if not exists idx_es_razao
        on establishments_search using gin (razao_social gin_trgm_ops);
      analyze establishments_search;
    `);

    await client.query("drop table if exists _es_partner_basicos");

    const { rows } = await client.query<{ n: number }>(
      "select count(*)::int as n from establishments_search",
    );
    const hours = (Date.now() - started) / 3600000;
    console.log(
      `Done — ${Number(rows[0]?.n ?? totalInserted).toLocaleString()} rows in ${hours.toFixed(1)}h.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

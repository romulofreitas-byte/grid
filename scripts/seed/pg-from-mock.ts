#!/usr/bin/env tsx
/**
 * Load the in-memory mock RF sample into local Postgres.
 * Used when Receita zips are not downloaded yet.
 */

import { getDatabaseUrl } from "../ingest/config";
import { getMockStore } from "../../src/lib/data/mock-store";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  const store = getMockStore();

  try {
    console.log("Loading mock RF sample into Postgres...");
    await client.query("begin");

    for (const row of store.ref_cnae) {
      await client.query(
        `insert into ref_cnae (codigo, descricao) values ($1, $2)
         on conflict (codigo) do update set descricao = excluded.descricao`,
        [row.codigo, row.descricao],
      );
    }
    for (const row of store.ref_municipio) {
      await client.query(
        `insert into ref_municipio (id, nome, uf) values ($1, $2, $3)
         on conflict (id) do update set nome = excluded.nome, uf = excluded.uf`,
        [row.id, row.nome, row.uf],
      );
    }
    for (const row of store.ref_qualificacao) {
      await client.query(
        `insert into ref_qualificacao (id, descricao) values ($1, $2)
         on conflict (id) do update set descricao = excluded.descricao`,
        [row.id, row.descricao],
      );
    }

    for (const row of store.companies) {
      await client.query(
        `insert into companies
           (cnpj_basico, razao_social, natureza_id, qualificacao_responsavel, capital_social, porte)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (cnpj_basico) do update set
           razao_social = excluded.razao_social,
           capital_social = excluded.capital_social,
           porte = excluded.porte`,
        [
          row.cnpj_basico,
          row.razao_social,
          row.natureza_id,
          row.qualificacao_responsavel,
          row.capital_social,
          row.porte,
        ],
      );
    }

    for (const row of store.establishments) {
      await client.query(
        `insert into establishments (
           cnpj, cnpj_basico, is_matriz, nome_fantasia, situacao, data_situacao,
           data_inicio, cnae_principal, cnae_secundarios, logradouro, numero,
           complemento, bairro, cep, uf, municipio_id, ddd1, telefone1, ddd2,
           telefone2, email
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
         )
         on conflict (cnpj) do update set
           nome_fantasia = excluded.nome_fantasia,
           telefone1 = excluded.telefone1,
           email = excluded.email`,
        [
          row.cnpj,
          row.cnpj_basico,
          row.is_matriz,
          row.nome_fantasia,
          row.situacao,
          row.data_situacao,
          row.data_inicio,
          row.cnae_principal,
          row.cnae_secundarios,
          row.logradouro,
          row.numero,
          row.complemento,
          row.bairro,
          row.cep,
          row.uf,
          row.municipio_id,
          row.ddd1,
          row.telefone1,
          row.ddd2,
          row.telefone2,
          row.email,
        ],
      );
    }

    await client.query("delete from partners");
    for (const row of store.partners) {
      await client.query(
        `insert into partners (cnpj_basico, nome, qualificacao_id, data_entrada, faixa_etaria)
         values ($1,$2,$3,$4,$5)`,
        [
          row.cnpj_basico,
          row.nome,
          row.qualificacao_id,
          row.data_entrada,
          row.faixa_etaria,
        ],
      );
    }

    for (const row of store.simples_nacional) {
      await client.query(
        `insert into simples_nacional (cnpj_basico, opcao_simples, opcao_mei)
         values ($1,$2,$3)
         on conflict (cnpj_basico) do update set
           opcao_simples = excluded.opcao_simples,
           opcao_mei = excluded.opcao_mei`,
        [row.cnpj_basico, row.opcao_simples, row.opcao_mei],
      );
    }

    await client.query("commit");
    console.log("Refreshing materialized views...");
    await client.query(`
      create materialized view if not exists cnae_uf_count as
      select cnae_principal, uf, count(*)::int as n
      from establishments
      group by 1, 2
      with no data
    `);
    await client.query(
      "create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf)",
    );
    for (const view of [
      "phone_usage",
      "email_usage",
      "address_usage",
      "phone_shared_verdict",
      "cnae_uf_count",
    ]) {
      await client.query(`refresh materialized view ${view}`);
    }

    const n = await client.query("select count(*)::int as n from establishments");
    console.log(`Loaded ${n.rows[0].n} establishments from mock sample.`);
    console.log("Replace later with: pnpm ingest:download && pnpm ingest --ufs=MG,SP");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

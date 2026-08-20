/** SQL fragments for the establishments_search fast path. */

export function scoreProxyOrderSql(alias = "es"): string {
  return `(
    (case when ${alias}.tem_decisor then 7 else 0 end) +
    (case when ${alias}.telefone1 is not null then 5 else 0 end) +
    (case when ${alias}.phone_verdict = 'proprio' then 10
          when ${alias}.phone_verdict = 'contabilidade' then -5
          else 3 end) +
    (case when ${alias}.email_proprio then 5 else 0 end) +
    (case when ${alias}.is_matriz then 1 else 0 end)
  ) desc, ${alias}.cnpj`;
}

/** Single-pass count + stats + top municípios (cap via limitParam). */
export function flatCountSql(
  filterSql: string,
  joinSql: string,
  limitParam: number,
): string {
  return `with matched as (
       select es.telefone1, es.email, es.tem_decisor, es.municipio_id
       from establishments_search es
       ${joinSql}
       where ${filterSql}
       limit $${limitParam}
     ),
     capped_matched as (
       select * from matched
       limit ${FLAT_COUNT_CAP}
     ),
     stats as (
       select
         (select count(*)::int from matched) as total_probe,
         count(*) filter (where telefone1 is not null)::int as com_telefone,
         count(*) filter (where email is not null)::int as com_email,
         count(*) filter (where tem_decisor)::int as com_decisor
       from capped_matched
     ),
     top_mun as (
       select m.municipio_id,
              coalesce(r.nome, 'NÃO ENCONTRADO') as nome,
              coalesce(r.uf, '') as uf,
              count(*)::int as total
       from capped_matched m
       left join ref_municipio r on r.id = m.municipio_id
       group by 1, 2, 3
       order by total desc
       limit 5
     )
     select
       s.total_probe,
       s.com_telefone,
       s.com_email,
       s.com_decisor,
       coalesce(
         (select json_agg(json_build_object(
           'municipio_id', t.municipio_id,
           'nome', t.nome,
           'uf', t.uf,
           'total', t.total
         ) order by t.total desc) from top_mun t),
         '[]'::json
       ) as por_municipio
     from stats s`;
}

/**
 * Rank on the skinny search table first, then PK-join establishments
 * for the capped candidate set only.
 */
export function flatRankedEstablishmentsSql(
  filterSql: string,
  joinSql: string,
  limitParam: number,
): string {
  return `with ranked as (
       select es.cnpj
       from establishments_search es
       ${joinSql}
       where ${filterSql}
       order by ${scoreProxyOrderSql("es")}
       limit $${limitParam}
     )
     select e.*
     from ranked r
     join establishments e on e.cnpj = r.cnpj`;
}

export const FLAT_COUNT_CAP = 10000;

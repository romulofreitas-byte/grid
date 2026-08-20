/** SQL fragments for the establishments_search fast path. */

/** Bind CNAE/UF as char arrays so Postgres can use (cnae_principal, uf, …) indexes. */
export const CNAE_ANY_SQL = "any(?::char(7)[])";
export const UF_ANY_SQL = "any(?::char(2)[])";

export function cnaeChar7Params(codes: string[]): string[] {
  return [
    ...new Set(
      codes
        .map((c) => c.replace(/\D/g, "").padStart(7, "0"))
        .filter((c) => c.length === 7),
    ),
  ];
}

export function ufChar2Params(ufs: string[]): string[] {
  return [
    ...new Set(
      ufs
        .map((u) => u.trim().toUpperCase().slice(0, 2))
        .filter((u) => u.length === 2),
    ),
  ];
}

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

export type FlatCountSqlOpts = {
  includeStats?: boolean;
  cap?: number;
};

/** Single-pass count + optional contact stats + top municípios (cap via limitParam). */
export function flatCountSql(
  filterSql: string,
  joinSql: string,
  limitParam: number,
  opts: FlatCountSqlOpts = {},
): string {
  const includeStats = opts.includeStats ?? true;
  const cap = opts.cap ?? FLAT_COUNT_CAP;
  const matchedCols = includeStats
    ? "es.telefone1, es.email, es.tem_decisor, es.municipio_id"
    : "es.municipio_id";
  const statsSelect = includeStats
    ? `(select count(*)::int from matched) as total_probe,
         count(*) filter (where telefone1 is not null)::int as com_telefone,
         count(*) filter (where email is not null)::int as com_email,
         count(*) filter (where tem_decisor)::int as com_decisor`
    : `(select count(*)::int from matched) as total_probe,
         0 as com_telefone,
         0 as com_email,
         0 as com_decisor`;

  return `with matched as (
       select ${matchedCols}
       from establishments_search es
       ${joinSql}
       where ${filterSql}
       limit $${limitParam}
     ),
     capped_matched as (
       select * from matched
       limit ${cap}
     ),
     stats as (
       select
         ${statsSelect}
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
/** Live sidebar probe when mode is `total` (region step / cities). */
export const FLAT_COUNT_PREVIEW_CAP = 2000;

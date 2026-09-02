import { describe, expect, it } from "vitest";
import {
  CNAE_ANY_SQL,
  FLAT_COUNT_CAP,
  FLAT_COUNT_PREVIEW_CAP,
  SEARCH_CANDIDATE_CAP,
  UF_ANY_SQL,
  cnaeChar7Params,
  flatCountSql,
  flatEstablishmentsByCnpjsSql,
  flatRankedEstablishmentsSql,
  ufChar2Params,
} from "./establishments-search-sql";

const FILTER = `es.opted_out = false\n    and es.cnae_principal = ${CNAE_ANY_SQL.replace("?", "$1")}`;

describe("cnae/uf char params", () => {
  it("pads CNAEs to char(7) and UFs to two letters", () => {
    expect(cnaeChar7Params(["5611-2/01", "5611203"])).toEqual([
      "5611201",
      "5611203",
    ]);
    expect(ufChar2Params(["sp", "MG"])).toEqual(["SP", "MG"]);
  });

  it("exports typed ANY fragments for index-friendly filters", () => {
    expect(CNAE_ANY_SQL).toContain("char(7)[]");
    expect(UF_ANY_SQL).toContain("char(2)[]");
    expect(FILTER).toContain("char(7)[]");
  });
});

describe("flatCountSql", () => {
  it("scans establishments_search once and includes município breakdown", () => {
    const sql = flatCountSql(FILTER, "", 2);
    const scans = sql.match(/from establishments_search/g) ?? [];
    expect(scans).toHaveLength(1);
    expect(sql).toContain("from capped_matched");
    expect(sql).toContain("top_mun");
    expect(sql).toContain("com_telefone");
    expect(sql).toContain(`limit ${FLAT_COUNT_CAP}`);
    expect(sql).toContain("limit $2");
  });

  it("includes CNPJs only when the probe is within the candidate cap", () => {
    const sql = flatCountSql(FILTER, "", 2, { includeStats: true, includeCnpjs: true });
    expect(sql).toContain("es.cnpj");
    expect(sql).toContain("json_agg(c.cnpj)");
    expect(sql).toContain(`when s.total_probe <= ${SEARCH_CANDIDATE_CAP}`);
  });

  it("skips contact stats in total mode and uses the preview cap", () => {
    const sql = flatCountSql(FILTER, "", 2, {
      includeStats: false,
      cap: FLAT_COUNT_PREVIEW_CAP,
    });
    expect(sql).toContain("0 as com_telefone");
    expect(sql).not.toContain("filter (where telefone1 is not null)");
    expect(sql).toContain(`limit ${FLAT_COUNT_PREVIEW_CAP}`);
    expect(sql).toContain("top_mun");
    expect(sql).toContain("null::json as cnpjs");
    expect(sql).not.toContain("json_agg(c.cnpj)");
  });
});

describe("flatRankedEstablishmentsSql", () => {
  it("ranks on the search table without joining establishments", () => {
    const sql = flatRankedEstablishmentsSql(FILTER, "", 3);
    expect(sql).toContain("from establishments_search es");
    expect(sql).toContain("limit $3");
    expect(sql).not.toContain("join establishments");
    expect(sql).toContain("es.cnpj");
    expect(sql).toContain("es.cnpj_basico");
  });
});

describe("flatEstablishmentsByCnpjsSql", () => {
  it("looks up skinny rows by typed CNPJ array", () => {
    const sql = flatEstablishmentsByCnpjsSql();
    expect(sql).toContain("from establishments_search es");
    expect(sql).toContain("es.cnpj = any($1::char(14)[])");
    expect(sql).not.toContain("join establishments");
  });
});

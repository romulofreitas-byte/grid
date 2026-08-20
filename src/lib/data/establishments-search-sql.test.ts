import { describe, expect, it } from "vitest";
import {
  FLAT_COUNT_CAP,
  flatCountSql,
  flatRankedEstablishmentsSql,
} from "./establishments-search-sql";

const FILTER = "es.opted_out = false\n    and es.cnae_principal = any($1::text[])";

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
});

describe("flatRankedEstablishmentsSql", () => {
  it("limits on the search table before joining establishments", () => {
    const sql = flatRankedEstablishmentsSql(FILTER, "", 3);
    const rankedBlock = sql.slice(0, sql.indexOf("select e.*"));
    expect(rankedBlock).toContain("from establishments_search es");
    expect(rankedBlock).toContain("limit $3");
    expect(rankedBlock).not.toContain("join establishments");
    expect(sql).toContain("from ranked r");
    expect(sql).toContain("join establishments e on e.cnpj = r.cnpj");
  });
});

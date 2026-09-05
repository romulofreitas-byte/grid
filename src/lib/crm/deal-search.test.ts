import { describe, expect, it } from "vitest";
import {
  canSearchDeals,
  dealMatchesSearch,
  rankDealSearchHits,
  type DealSearchRankable,
} from "./deal-search";
import type { CrmPerson } from "@/lib/crm/types";

function deal(
  patch: Partial<DealSearchRankable> & Pick<DealSearchRankable, "id" | "company_name">,
): DealSearchRankable {
  return {
    pipeline_id: "p1",
    contact_name: "",
    cnpj: null,
    phones: [],
    people: [],
    updated_at: "2026-09-01T12:00:00.000Z",
    ...patch,
  };
}

function person(name: string, phone = ""): CrmPerson {
  return { name, phone, email: "" };
}

describe("canSearchDeals", () => {
  it("allows two letters or four digits", () => {
    expect(canSearchDeals("a")).toBe(false);
    expect(canSearchDeals("ab")).toBe(true);
    expect(canSearchDeals("123")).toBe(false);
    expect(canSearchDeals("1234")).toBe(true);
    expect(canSearchDeals("11 99")).toBe(true);
  });
});

describe("dealMatchesSearch", () => {
  it("folds accents in the company name", () => {
    const row = deal({ id: "1", company_name: "São Paulo Mármores" });
    expect(dealMatchesSearch(row, "sao paulo")).toBe(true);
    expect(dealMatchesSearch(row, "marmores")).toBe(true);
    expect(dealMatchesSearch(row, "padaria")).toBe(false);
  });

  it("matches a partial CNPJ", () => {
    const row = deal({
      id: "1",
      company_name: "Empresa A",
      cnpj: "12345678000190",
    });
    expect(dealMatchesSearch(row, "12345678")).toBe(true);
    expect(dealMatchesSearch(row, "12.345.678")).toBe(true);
    expect(dealMatchesSearch(row, "99999999")).toBe(false);
  });

  it("matches a masked phone", () => {
    const row = deal({
      id: "1",
      company_name: "Padaria Fone",
      phones: ["(34) 99999-0000"],
    });
    expect(dealMatchesSearch(row, "349999")).toBe(true);
    expect(dealMatchesSearch(row, "34 99999 0000")).toBe(true);
  });

  it("matches a contact stored on people", () => {
    const row = deal({
      id: "1",
      company_name: "Oficina",
      contact_name: "",
      people: [person("Ana Carvalho", "(34) 98888-1111")],
    });
    expect(dealMatchesSearch(row, "carvalho")).toBe(true);
    expect(dealMatchesSearch(row, "98888")).toBe(true);
  });

  it("includes won and lost deals", () => {
    const won = deal({ id: "1", company_name: "Padaria Ganho" });
    expect(dealMatchesSearch(won, "padaria")).toBe(true);
  });
});

describe("rankDealSearchHits", () => {
  it("prefers the current pipeline, then a company prefix", () => {
    const other = deal({
      id: "other",
      pipeline_id: "p2",
      company_name: "Padaria Central",
      updated_at: "2026-09-04T12:00:00.000Z",
    });
    const prefix = deal({
      id: "prefix",
      pipeline_id: "p1",
      company_name: "Padaria do João",
      updated_at: "2026-09-01T12:00:00.000Z",
    });
    const later = deal({
      id: "later",
      pipeline_id: "p1",
      company_name: "Nova Padaria",
      updated_at: "2026-09-03T12:00:00.000Z",
    });
    const ranked = rankDealSearchHits([other, later, prefix], "padaria", "p1");
    expect(ranked.map((row) => row.id)).toEqual(["prefix", "later", "other"]);
  });
});

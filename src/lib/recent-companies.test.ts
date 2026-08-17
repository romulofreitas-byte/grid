import { describe, expect, it } from "vitest";
import {
  RECENT_COMPANIES_KEY,
  RECENT_COMPANIES_MAX,
  readRecentCompanies,
  rememberRecentCompany,
  type RecentStorage,
} from "./recent-companies";

function memoryStorage(seed?: string): RecentStorage {
  const map = new Map<string, string>();
  if (seed) map.set(RECENT_COMPANIES_KEY, seed);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function hit(cnpj: string, name = "Empresa") {
  return {
    cnpj,
    razaoSocial: name,
    nomeFantasia: null,
    municipio: "Belo Horizonte",
    uf: "MG",
  };
}

describe("recent companies", () => {
  it("returns empty when storage is missing or invalid", () => {
    expect(readRecentCompanies(null)).toEqual([]);
    expect(readRecentCompanies(memoryStorage("not-json"))).toEqual([]);
  });

  it("keeps the latest company first and caps at 5", () => {
    const storage = memoryStorage();
    for (let i = 1; i <= 6; i += 1) {
      rememberRecentCompany(hit(`${"1234567800010"}${i}`, `E${i}`), storage, i);
    }
    const recent = readRecentCompanies(storage);
    expect(recent).toHaveLength(RECENT_COMPANIES_MAX);
    expect(recent.map((r) => r.razaoSocial)).toEqual(["E6", "E5", "E4", "E3", "E2"]);
  });

  it("moves a repeated CNPJ to the top instead of duplicating", () => {
    const storage = memoryStorage();
    rememberRecentCompany(hit("12345678000190", "Primeira"), storage, 1);
    rememberRecentCompany(hit("12345678000191", "Segunda"), storage, 2);
    rememberRecentCompany(hit("12345678000190", "Primeira de novo"), storage, 3);
    const recent = readRecentCompanies(storage);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.cnpj).toBe("12345678000190");
    expect(recent[0]?.razaoSocial).toBe("Primeira de novo");
  });
});

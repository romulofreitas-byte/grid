import { describe, expect, it } from "vitest";
import { CnpjBitset } from "./bitset";
import { toTsvLine, tsvEscape } from "./copy";
import {
  isMonthDumpZip,
  isSkippedArchive,
  matchesKindEntry,
  matchesKindZip,
} from "./kinds";
import { parseArgs } from "./config";

describe("RF file kinds", () => {
  it("matches shard zip names", () => {
    expect(matchesKindZip("Empresas0.zip", "empresas")).toBe(true);
    expect(matchesKindZip("2026-08/Estabelecimentos9.zip", "estabelecimentos")).toBe(
      true,
    );
    expect(matchesKindZip("Socios3.zip", "socios")).toBe(true);
    expect(matchesKindZip("Simples.zip", "simples")).toBe(true);
    expect(matchesKindZip("Empresas0.zip", "estabelecimentos")).toBe(false);
  });

  it("matches inner RF suffixes without .csv", () => {
    expect(matchesKindEntry("K3241.K03200Y0.D60809.EMPRECSV", "empresas")).toBe(
      true,
    );
    expect(matchesKindEntry("K3241.K03200Y0.D60809.ESTABELE", "estabelecimentos")).toBe(
      true,
    );
    expect(matchesKindEntry("K3241.K03200Y0.D60809.SOCIOCSV", "socios")).toBe(true);
    expect(matchesKindEntry("F.K03200$W.SIMPLES.CSV.D60809", "simples")).toBe(true);
    expect(matchesKindEntry("Cnaes.zip", "cnaes")).toBe(false);
  });

  it("skips Motivos and Paises", () => {
    expect(isSkippedArchive("Motivos.zip")).toBe(true);
    expect(isSkippedArchive("Paises.zip")).toBe(true);
    expect(isSkippedArchive("Empresas0.zip")).toBe(false);
  });

  it("detects month dump zip", () => {
    expect(isMonthDumpZip("2026-08.zip")).toBe(true);
    expect(isMonthDumpZip("Empresas0.zip")).toBe(false);
  });
});

describe("parseArgs", () => {
  it("defaults to MG,SP", () => {
    expect(parseArgs([])).toEqual({ ufs: ["MG", "SP"], dryRun: false, help: false });
  });

  it("expands --ufs=ALL", () => {
    const args = parseArgs(["--ufs=ALL", "--dry-run"]);
    expect(args.ufs).toHaveLength(27);
    expect(args.ufs).toContain("AC");
    expect(args.ufs).toContain("SP");
    expect(args.dryRun).toBe(true);
  });
});

describe("CnpjBitset", () => {
  it("stores CNPJ básico as bits, treating padded and unpadded as the same", () => {
    const set = new CnpjBitset();
    expect(set.add("12345678")).toBe(true);
    expect(set.add("12345678")).toBe(false);
    expect(set.has("12345678")).toBe(true);
    expect(set.has("00000001")).toBe(false);
    expect(set.has("1")).toBe(false);
    set.add("1");
    expect(set.has("00000001")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("tsvEscape", () => {
  it("uses Postgres text null and escapes tabs", () => {
    expect(tsvEscape(null)).toBe("\\N");
    expect(tsvEscape("")).toBe("\\N");
    expect(tsvEscape(true)).toBe("t");
    expect(tsvEscape("a\tb")).toBe("a\\tb");
    expect(toTsvLine(["x", null, 3])).toBe("x\t\\N\t3\n");
  });
});

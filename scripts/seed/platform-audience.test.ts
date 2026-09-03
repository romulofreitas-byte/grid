import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  audienceExportStamp,
  parseCsvEmails,
  parseCsvRecords,
  pickNewestAudienceNames,
  resolveAudienceCsvPath,
} from "../../scripts/seed/platform-audience";
import { REPO_ROOT } from "../ingest/config";

describe("parseCsvRecords", () => {
  it("handles quoted fields with commas and newlines", () => {
    const rows = parseCsvRecords(
      'a,b\n"id","line1\nline2",c@x.com\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]![2]).toBe("c@x.com");
  });
});

describe("parseCsvEmails", () => {
  it("reads E-mail column from Circle header", () => {
    const emails = parseCsvEmails(
      "ID,E-mail\n1,alfa@test.com\n2,beta@test.com\n",
    );
    expect(emails).toEqual(["alfa@test.com", "beta@test.com"]);
  });
});

describe("pickNewestAudienceNames", () => {
  it("prefers the Circle export with the highest stamp", () => {
    expect(
      pickNewestAudienceNames([
        "community_mundo_podium_356405_1787003890_audience_list.csv",
        "config.toml",
        "community_mundo_podium_356405_1788401072_audience_list.csv.zip",
        "community_mundo_podium_356405_1788401072_audience_list.csv",
      ])[0],
    ).toBe("community_mundo_podium_356405_1788401072_audience_list.csv");
    expect(
      audienceExportStamp(
        "community_mundo_podium_356405_1788401072_audience_list.csv",
      ),
    ).toBe(1788401072);
  });
});

describe("resolveAudienceCsvPath", () => {
  it("finds csv inside the newest audience folder in supabase", () => {
    const supabaseDir = path.join(REPO_ROOT, "supabase");
    const newest = pickNewestAudienceNames(readdirSync(supabaseDir)).find(
      (name) => !name.toLowerCase().endsWith(".zip"),
    );
    if (!newest) return;
    const resolved = resolveAudienceCsvPath(path.join(supabaseDir, newest));
    expect(resolved).toMatch(/audience_list\.csv$/);
    expect(resolved).toMatch(/1788401072/);
  });
});

describe("Circle audience file", () => {
  it("parses at least one member e-mail from the newest bundled export", () => {
    const supabaseDir = path.join(REPO_ROOT, "supabase");
    const newest = pickNewestAudienceNames(readdirSync(supabaseDir)).find(
      (name) => !name.toLowerCase().endsWith(".zip"),
    );
    if (!newest) return;
    const csvPath = resolveAudienceCsvPath(path.join(supabaseDir, newest));
    if (!csvPath) return;
    const emails = parseCsvEmails(readFileSync(csvPath, "utf8"));
    expect(emails.length).toBeGreaterThan(0);
    expect(emails).toContain("administracao@combustivelmv.com");
  });
});

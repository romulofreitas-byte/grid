import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCsvEmails,
  parseCsvRecords,
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

describe("resolveAudienceCsvPath", () => {
  it("finds csv inside audience folder in supabase", () => {
    const folder = path.join(
      REPO_ROOT,
      "supabase",
      "community_mundo_podium_356405_1787003890_audience_list.csv",
    );
    const resolved = resolveAudienceCsvPath(folder);
    expect(resolved).toMatch(/audience_list\.csv$/);
  });
});

describe("Circle audience file", () => {
  it("parses at least one member e-mail from the bundled export", () => {
    const folder = path.join(
      REPO_ROOT,
      "supabase",
      "community_mundo_podium_356405_1787003890_audience_list.csv",
    );
    const csvPath = resolveAudienceCsvPath(folder);
    if (!csvPath) return;
    const emails = parseCsvEmails(readFileSync(csvPath, "utf8"));
    expect(emails.length).toBeGreaterThan(0);
    expect(emails).toContain("administracao@combustivelmv.com");
  });
});

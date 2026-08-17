import { describe, expect, it } from "vitest";
import {
  CATALOG_IDS,
  INTEGRATION_CATALOG,
  firstCatalogIdForKind,
  getCatalogItem,
  parseConexoesKind,
  resolveCatalogItem,
} from "./catalog";

describe("integration catalog", () => {
  it("includes Agendor and API4COM", () => {
    expect(getCatalogItem("agendor")?.name).toBe("Agendor");
    expect(getCatalogItem("api4com")?.kind).toBe("voip");
  });

  it("has unique ids", () => {
    expect(new Set(CATALOG_IDS).size).toBe(INTEGRATION_CATALOG.length);
  });

  it("resolves by display name when catalog_id is missing", () => {
    expect(resolveCatalogItem(null, "API4COM")?.id).toBe("api4com");
    expect(resolveCatalogItem("webhook", "Webhook")?.id).toBe("webhook");
  });

  it("parses /conexoes?kind= and picks the first tool in that section", () => {
    expect(parseConexoesKind("crm")).toBe("crm");
    expect(parseConexoesKind("voip")).toBe("voip");
    expect(parseConexoesKind("nope")).toBeNull();
    expect(firstCatalogIdForKind("crm")).toBe("agendor");
    expect(firstCatalogIdForKind("voip")).toBe("api4com");
  });
});

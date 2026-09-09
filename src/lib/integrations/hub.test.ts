import { describe, expect, it } from "vitest";
import {
  HUB_ITEMS,
  filterHubItems,
  getHubItem,
  hubItemsBySection,
} from "./hub";

describe("integration hub catalog", () => {
  it("lists capture, automation and telephony without CRM outbound", () => {
    expect(hubItemsBySection("captacao").map((item) => item.id)).toEqual([
      "meta",
      "site",
      "planilha",
    ]);
    expect(hubItemsBySection("automacoes").map((item) => item.id)).toEqual([
      "zapier",
      "make",
      "n8n",
      "webhook",
    ]);
    expect(HUB_ITEMS.some((item) => item.id === "hubspot")).toBe(false);
    expect(HUB_ITEMS.some((item) => item.id === "pipedrive")).toBe(false);
  });

  it("keeps unique ids and live Meta / 3C Plus hrefs", () => {
    expect(new Set(HUB_ITEMS.map((item) => item.id)).size).toBe(HUB_ITEMS.length);
    expect(getHubItem("meta")?.href).toBe("/integracoes/meta");
    expect(getHubItem("3cplus")?.href).toMatch(/tab=discador/);
    expect(getHubItem("api4com")?.href).toMatch(/provider=api4com/);
    expect(getHubItem("asterisk")?.availability).toBe("soon");
    expect(getHubItem("asterisk")?.href).toBeNull();
  });

  it("filters by name", () => {
    expect(filterHubItems("meta").map((item) => item.id)).toEqual(["meta"]);
    expect(filterHubItems("  ").length).toBe(HUB_ITEMS.length);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMetaPages, mapMetaLeadToInbound, parseLeadgenPayload } from "./meta-leads";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function graphPath(input: RequestInfo | URL): string {
  const url = new URL(String(input));
  return url.pathname.replace(/^\/v\d+\.\d+/, "");
}

describe("mapMetaLeadToInbound", () => {
  it("maps Instant Form fields to inbound JSON", () => {
    expect(
      mapMetaLeadToInbound({
        id: "lead1",
        field_data: [
          { name: "full_name", values: ["Maria Silva"] },
          { name: "email", values: ["maria@x.com"] },
          { name: "phone_number", values: ["11999999999"] },
          { name: "company_name", values: ["Padaria"] },
          { name: "volume", values: ["10 t"] },
        ],
      }),
    ).toEqual({
      kind: "person",
      name: "Maria Silva",
      email: "maria@x.com",
      phone: "11999999999",
      company: "Padaria",
      answers: { volume: "10 t" },
    });
  });

  it("joins first and last name when full_name is missing", () => {
    expect(
      mapMetaLeadToInbound({
        id: "lead2",
        field_data: [
          { name: "first_name", values: ["João"] },
          { name: "last_name", values: ["Souza"] },
        ],
      }),
    ).toMatchObject({ name: "João Souza" });
  });
});

describe("parseLeadgenPayload", () => {
  it("reads leadgen_id from a Graph webhook body", () => {
    expect(
      parseLeadgenPayload({
        entry: [
          {
            id: "page-1",
            changes: [
              {
                field: "leadgen",
                value: {
                  leadgen_id: "lg-9",
                  form_id: "form-3",
                  page_id: "page-1",
                },
              },
            ],
          },
        ],
      }),
    ).toEqual([
      { pageId: "page-1", formId: "form-3", leadgenId: "lg-9" },
    ]);
  });

  it("ignores other change fields", () => {
    expect(
      parseLeadgenPayload({
        entry: [{ id: "page-1", changes: [{ field: "feed", value: {} }] }],
      }),
    ).toEqual([]);
  });
});

describe("listMetaPages", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps pages from /me/accounts and fills missing tokens", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = graphPath(input);
      if (path === "/me/accounts") {
        return jsonRes({
          data: [
            { id: "p1", name: "Página A", access_token: "tok-a" },
            { id: "p2", name: "Página B" },
          ],
        });
      }
      if (path === "/me/assigned_pages" || path === "/me/businesses") {
        return jsonRes({ data: [] });
      }
      if (path === "/p2") {
        return jsonRes({ id: "p2", name: "Página B", access_token: "tok-b" });
      }
      return jsonRes({ error: { message: path } }, 400);
    });
    await expect(listMetaPages("user-tok")).resolves.toEqual([
      { id: "p1", name: "Página A", access_token: "tok-a" },
      { id: "p2", name: "Página B", access_token: "tok-b" },
    ]);
  });

  it("merges Business Manager owned pages when /me/accounts is empty", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = graphPath(input);
      if (path === "/me/accounts") return jsonRes({ data: [] });
      if (path === "/me/assigned_pages") return jsonRes({ data: [] });
      if (path === "/me/businesses") return jsonRes({ data: [{ id: "biz-1" }] });
      if (path === "/biz-1/owned_pages") {
        return jsonRes({
          data: [{ id: "p9", name: "Cliente X", access_token: "tok-9" }],
        });
      }
      if (path === "/biz-1/client_pages") return jsonRes({ data: [] });
      return jsonRes({ error: { message: path } }, 400);
    });
    await expect(listMetaPages("user-tok")).resolves.toEqual([
      { id: "p9", name: "Cliente X", access_token: "tok-9" },
    ]);
  });

  it("returns empty when a listed page never yields an access token", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const path = graphPath(input);
      if (path === "/me/accounts") {
        return jsonRes({ data: [{ id: "p1", name: "Sem token" }] });
      }
      if (path === "/me/assigned_pages" || path === "/me/businesses") {
        return jsonRes({ data: [] });
      }
      if (path === "/p1") return jsonRes({ error: { message: "no token" } }, 400);
      return jsonRes({ error: { message: path } }, 400);
    });
    await expect(listMetaPages("user-tok")).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});

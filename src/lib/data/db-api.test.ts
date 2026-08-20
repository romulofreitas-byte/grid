import { describe, expect, it, vi } from "vitest";
import { dbUnavailableResponse } from "./db-api";

describe("dbUnavailableResponse", () => {
  it("returns 503 without leaking internals", async () => {
    const err = Object.assign(new Error("password=secret postgresql://grid:grid@localhost/grid"), {
      code: "55000",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbUnavailableResponse(err, "niches_counts");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("indisponível");
    expect(body.error).not.toContain("password");
    expect(body.error).not.toContain("55000");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("postgresql://");
    spy.mockRestore();
  });
});

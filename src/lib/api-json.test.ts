import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/copy";
import { httpErrorMessage, readResponseJson } from "@/lib/api-json";

describe("readResponseJson", () => {
  it("parses a JSON body", async () => {
    const res = new Response(JSON.stringify({ created: 2 }), { status: 200 });
    await expect(readResponseJson(res)).resolves.toEqual({ created: 2 });
  });

  it("returns null when the gateway sent HTML", async () => {
    const res = new Response("An error occurred", { status: 504 });
    await expect(readResponseJson(res)).resolves.toBeNull();
  });
});

describe("httpErrorMessage", () => {
  it("prefers the API error field", () => {
    expect(
      httpErrorMessage(400, { error: "Escolha o nicho." }, "falhou"),
    ).toBe("Escolha o nicho.");
  });

  it("names a gateway timeout instead of a JSON parse crash", () => {
    expect(httpErrorMessage(504, null, "Não foi possível importar")).toBe(
      COPY.apiTimeout,
    );
    expect(
      httpErrorMessage(
        504,
        null,
        "Não foi possível importar",
        COPY.importacoesTimeout,
      ),
    ).toBe(COPY.importacoesTimeout);
  });

  it("keeps the fallback for other HTML errors", () => {
    expect(httpErrorMessage(500, null, "Não foi possível importar")).toBe(
      "Não foi possível importar",
    );
  });
});

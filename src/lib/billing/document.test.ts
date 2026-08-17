import { describe, expect, it } from "vitest";
import { formatDocumento, parseDocumento } from "./document";

describe("parseDocumento", () => {
  it("accepts a valid CPF", () => {
    expect(parseDocumento("529.982.247-25")).toEqual({
      digits: "52998224725",
      tipo: "cpf",
    });
  });

  it("accepts a valid CNPJ", () => {
    expect(parseDocumento("11.222.333/0001-81")).toEqual({
      digits: "11222333000181",
      tipo: "cnpj",
    });
  });

  it("rejects invalid checksums", () => {
    expect(parseDocumento("111.111.111-11")).toBeNull();
    expect(parseDocumento("00.000.000/0000-00")).toBeNull();
    expect(parseDocumento("123")).toBeNull();
  });
});

describe("formatDocumento", () => {
  it("masks CPF and CNPJ", () => {
    expect(formatDocumento("52998224725", "cpf")).toBe("529.982.247-25");
    expect(formatDocumento("11222333000181", "cnpj")).toBe("11.222.333/0001-81");
  });
});

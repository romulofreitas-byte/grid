import { describe, expect, it } from "vitest";
import { CALCULADORA_GLOSSARIO } from "@/lib/copy";

describe("calculadora glossary", () => {
  it("explains realized meetings and what stays out of the rate", () => {
    expect(CALCULADORA_GLOSSARIO).toHaveLength(6);
    const joined = CALCULADORA_GLOSSARIO.map((item) => item.body).join(" ");
    expect(joined).toMatch(/R1/);
    expect(joined).toMatch(/R2/);
    expect(joined).toMatch(/no-show/);
    expect(joined).toMatch(/secretária/);
    expect(joined).not.toMatch(/especialidade/);
  });
});

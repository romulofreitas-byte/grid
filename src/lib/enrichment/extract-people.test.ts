import { describe, expect, it } from "vitest";
import { classifyPapel, extractPeople, isPersonName } from "./extract-people";

const AGENCY_HTML = `<!doctype html>
<html>
<body>
  <main>
    <p>Diretor Comercial: João Santos Lima</p>
  </main>
  <footer>
    <div class="credits">
      desenvolvido por Agência Web Design
      <p>Diretor: Pedro Agencia Silva</p>
    </div>
  </footer>
</body>
</html>`;

describe("isPersonName", () => {
  it("accepts Brazilian personal names and rejects companies", () => {
    expect(isPersonName("João Santos Lima")).toBe(true);
    expect(isPersonName("Ana Paula Souza")).toBe(true);
    expect(isPersonName("COMERCIO SILVA LTDA")).toBe(false);
    expect(isPersonName("Equipe")).toBe(false);
    expect(isPersonName("João 2")).toBe(false);
  });
});

describe("classifyPapel", () => {
  it("marks sales and finance as recommended doors", () => {
    expect(classifyPapel("Diretor Comercial")).toEqual({
      papel: "vendas",
      portaRecomendada: true,
    });
    expect(classifyPapel("Diretora de Vendas")).toEqual({
      papel: "vendas",
      portaRecomendada: true,
    });
    expect(classifyPapel("Diretor Financeiro")).toEqual({
      papel: "financeiro",
      portaRecomendada: true,
    });
    expect(classifyPapel("Diretora Financeira")).toEqual({
      papel: "financeiro",
      portaRecomendada: true,
    });
    expect(classifyPapel("CFO")).toEqual({
      papel: "financeiro",
      portaRecomendada: true,
    });
    expect(classifyPapel("Diretor de Operações")).toEqual({
      papel: "diretoria",
      portaRecomendada: false,
    });
  });
});

describe("extractPeople", () => {
  it("reads Person + jobTitle from JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Organization",
      employee: [
        {
          "@type": "Person",
          name: "João Santos Lima",
          jobTitle: "Diretor Comercial",
        },
        {
          "@type": "Person",
          name: "Ana Costa Ribeiro",
          jobTitle: "Diretora Financeira",
        },
      ],
    })}</script>`;
    const people = extractPeople(html);
    expect(people.map((p) => p.nome)).toEqual([
      "João Santos Lima",
      "Ana Costa Ribeiro",
    ]);
    expect(people.every((p) => p.fonte === "schema")).toBe(true);
    expect(people.every((p) => p.portaRecomendada)).toBe(true);
  });

  it("parses cargo: nome on the page", () => {
    const html = `<main><p>Diretor Comercial: Carlos Eduardo Lima</p></main>`;
    const people = extractPeople(html);
    expect(people[0]).toMatchObject({
      nome: "Carlos Eduardo Lima",
      cargo: "Diretor Comercial",
      papel: "vendas",
      portaRecomendada: true,
      fonte: "pagina",
    });
  });

  it("parses heading name plus role in the next element", () => {
    const html = `<section><h3>Mariana Costa Dias</h3><p>Diretor Financeiro</p></section>`;
    const people = extractPeople(html);
    expect(people[0]).toMatchObject({
      nome: "Mariana Costa Dias",
      cargo: "Diretor Financeiro",
      papel: "financeiro",
      portaRecomendada: true,
    });
  });

  it("skips agency credits and QSA duplicates", () => {
    const people = extractPeople(AGENCY_HTML, {
      qsaNomes: ["João Santos Lima"],
    });
    expect(people.map((p) => p.nome)).not.toContain("João Santos Lima");
    expect(people.map((p) => p.nome)).not.toContain("Pedro Agencia Silva");
  });

  it("rejects a company-style name even next to a role", () => {
    const html = `<p>Diretor Comercial: ALPHA HOLDING PARTICIPACOES LTDA</p>`;
    expect(extractPeople(html)).toEqual([]);
  });
});

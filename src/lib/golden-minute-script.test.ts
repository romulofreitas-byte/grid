import { describe, expect, it } from "vitest";
import { GOLDEN_MINUTE_PLACEHOLDER } from "./golden-minute";
import {
  anatomyAssembly,
  anatomyBeatsFromScript,
  buildOpeningScript,
  CONSIDERATION_LINE,
  copyAnatomyScript,
  ctaGlance,
  helloGlance,
  scriptFromAnatomyBeats,
  spokenLine,
  splitAnatomyBeats,
} from "./golden-minute-script";
import type { ScriptProfile } from "./golden-minute-script";
import type { MarketBrief } from "./types";

const empty: ScriptProfile = {
  nome: null,
  como_chama: null,
  tratamento: null,
  empresa_usuario: null,
  cidade_usuario: null,
  especialidade: null,
  area: null,
  promessa: null,
  duracao_reuniao: 20,
};

const market: MarketBrief = {
  slug: "hamburguerias",
  nome: "hamburgueria",
  dorPrincipal:
    "em BH, hamburgueria sofre com a semana morta: equipe de braço cruzado no meio da semana",
  dorChip: "Semana morta",
  perguntaConsideracao:
    "Como você tá lidando com as semanas mortas? Sua equipe fica de braço cruzado no meio da semana?",
  sazonalidade: "Dia dos Namorados enche; quem faz promoção em cima da hora perde margem",
  sazonalidadeChip: "Dia dos Namorados",
  sazonalidadeMeses: [6],
  sazonalidadeAtiva: true,
  janelaHorario: "melhor de manhã até as 14h",
  janelaChip: "De manhã até as 14h",
  cidade: "BH",
};

const genericMarket: MarketBrief = {
  ...market,
  slug: "generico",
  nome: "este ramo",
  dorPrincipal:
    "Em Belo Horizonte, cliente novo entra por indicação. Sem fila própria, o mês depende de quem já conhece.",
  perguntaConsideracao:
    "Como vocês captam cliente novo além da indicação?",
};

describe("spokenLine", () => {
  it("keeps the first sentence and drops the rest", () => {
    expect(
      spokenLine(
        "Em BH, cliente novo entra por indicação. Sem fila própria, o mês depende de quem já conhece.",
      ),
    ).toBe("Em BH, cliente novo entra por indicação.");
  });

  it("keeps a question as a single spoken line", () => {
    expect(
      spokenLine(
        "Como você tá lidando com as semanas mortas? Sua equipe fica de braço cruzado no meio da semana?",
      ),
    ).toBe("Como você tá lidando com as semanas mortas?");
  });
});

describe("anatomyAssembly", () => {
  it("leaves identity and promise empty on a blank profile", () => {
    const slots = anatomyAssembly(empty);
    expect(slots.artigo.value).toBeNull();
    expect(slots.nome.value).toBeNull();
    expect(slots.empresa.value).toBeNull();
    expect(slots.cidade.value).toBeNull();
    expect(slots.promessa.value).toBeNull();
    expect(slots.consideracao.value).toBeNull();
    expect(slots.duracao.value).toBe("20");
  });

  it("fills name, then company and city, without inventing market copy", () => {
    expect(anatomyAssembly({ ...empty, como_chama: "mundopodium" }).nome.value).toBe(
      "mundopodium",
    );
    const pista = anatomyAssembly({
      ...empty,
      como_chama: "mundopodium",
      tratamento: "o",
      empresa_usuario: "Combustível",
      cidade_usuario: "Belo Horizonte",
    });
    expect(pista.artigo.value).toBe("o");
    expect(pista.empresa.value).toBe("Combustível");
    expect(pista.cidade.value).toBe("Belo Horizonte");
    expect(pista.promessa.value).toBeNull();
    expect(pista.consideracao.value).toBeNull();
  });

  it("opens consideration only after the promise is sealed", () => {
    const slots = anatomyAssembly({
      ...empty,
      promessa: "inteligência de mercado pra potencializar vendas",
    });
    expect(slots.promessa.value).toMatch(/inteligência de mercado/i);
    expect(slots.consideracao.value).toBe(CONSIDERATION_LINE);
    expect(slots.consideracao.source).toBe("lead");
  });
});

describe("buildOpeningScript", () => {
  it("opens on identity and promise, not on seller specialty", () => {
    const script = buildOpeningScript(
      {
        ...empty,
        especialidade: "marketing digital",
        area: "vendas",
        promessa: "gerar demanda para indústrias",
      },
      { decisorNome: null },
    );
    expect(script).toContain("Olá aí, aqui é o Piloto da empresa de cidade.");
    expect(script).toContain("A gente entrega gerar demanda para indústrias.");
    expect(script).toContain(CONSIDERATION_LINE);
    expect(script).toContain("em 20 minutos");
    expect(script).not.toContain("especializados em marketing digital");
    expect(script).not.toContain("A gente acompanha");
  });

  it("fills identity slots and keeps the promise as the motive", () => {
    const script = buildOpeningScript(
      {
        ...empty,
        nome: "Rômulo Freitas",
        como_chama: "Rômulo",
        tratamento: "o",
        empresa_usuario: "Combustível",
        cidade_usuario: "BH",
        especialidade: "marketing digital",
        area: "vendas",
        promessa: "gerar demanda para indústrias",
        duracao_reuniao: 25,
      },
      {
        decisorNome: "João Carlos Lima",
        market,
      },
    );
    expect(script).toContain("Olá João, aqui é o Rômulo da Combustível de BH");
    expect(script).toContain("A gente entrega gerar demanda para indústrias.");
    expect(script).toContain("Como você tá lidando com as semanas mortas?");
    expect(script).toContain("em 25 minutos");
    expect(script).not.toContain("Piloto");
    expect(script).not.toContain("especializados em");
    expect(script).not.toContain("Dia dos Namorados");
    expect(script).not.toContain("braço cruzado");
  });

  it("does not use the generic pack as spoken copy", () => {
    const script = buildOpeningScript(empty, {
      decisorNome: "João Carlos",
      market: genericMarket,
    });
    expect(script).toContain(CONSIDERATION_LINE);
    expect(script).not.toContain("Sem fila própria");
    expect(script).not.toContain("além da indicação");
  });

  it("uses a/e articles from tratamento", () => {
    expect(
      buildOpeningScript(
        { ...empty, como_chama: "Maria", tratamento: "a" },
        { decisorNome: "Ana" },
      ),
    ).toContain("aqui é a Maria");
    expect(
      buildOpeningScript(
        { ...empty, como_chama: "Alex", tratamento: "e" },
        { decisorNome: "Ana" },
      ),
    ).toContain("aqui é e Alex");
  });
});

describe("splitAnatomyBeats", () => {
  it("returns three lines from the default script", () => {
    const script = buildOpeningScript(empty, { decisorNome: null, market });
    const beats = splitAnatomyBeats(script);
    expect(beats).toHaveLength(3);
    expect(beats?.[0]).toMatch(/^Olá aí,/);
    expect(beats?.[2]).toContain("em 20 minutos");
  });

  it("returns null when a beat is empty", () => {
    expect(splitAnatomyBeats("só uma linha")).toBeNull();
    expect(splitAnatomyBeats("uma\n\nduas")).toBeNull();
  });
});

describe("anatomyBeatsFromScript", () => {
  it("keeps three slots in anatomy order when editing one beat", () => {
    const start = buildOpeningScript(empty, {
      decisorNome: null,
      market,
    });
    const beats = anatomyBeatsFromScript(start);
    beats[1] = "Como está a semana morta de vocês?";
    const next = anatomyBeatsFromScript(scriptFromAnatomyBeats(beats));
    expect(next[0]).toMatch(/^Olá aí,/);
    expect(next[1]).toContain("semana morta");
    expect(next[2]).toContain("em 20 minutos");
  });

  it("pads short scripts into the three anatomy slots", () => {
    expect(anatomyBeatsFromScript("só abertura")).toEqual([
      "só abertura",
      "",
      "",
    ]);
  });

  it("copies beats in order, skipping empty slots", () => {
    expect(
      copyAnatomyScript("Abertura\n\nConsideração\nFechamento"),
    ).toBe("Abertura\nConsideração\nFechamento");
  });

  it("does not put the placeholder into a spoken script", () => {
    const script = buildOpeningScript(empty, { decisorNome: null, market });
    expect(script).not.toContain(GOLDEN_MINUTE_PLACEHOLDER);
  });
});

describe("anatomy glance", () => {
  it("compresses the hello line into name, company and city", () => {
    const script = buildOpeningScript(
      { ...empty, como_chama: "Rômulo", empresa_usuario: "Combustível", cidade_usuario: "BH" },
      { decisorNome: "João Carlos", market },
    );
    expect(helloGlance(anatomyBeatsFromScript(script)[0])).toBe(
      "Olá João · Combustível · BH",
    );
  });

  it("reads the meeting length from the closing beat", () => {
    expect(
      ctaGlance("Queria te mostrar isso em 25 minutos. Como está sua agenda?", 20),
    ).toBe("25 min · agenda?");
  });
});

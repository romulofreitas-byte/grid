import { describe, expect, it } from "vitest";
import { GOLDEN_MINUTE_PLACEHOLDER } from "./golden-minute";
import {
  anatomyBeatsFromScript,
  buildOpeningScript,
  copyAnatomyScript,
  ctaGlance,
  helloGlance,
  scriptFromAnatomyBeats,
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

describe("buildOpeningScript", () => {
  it("opens on market pain, not on the seller specialty", () => {
    const script = buildOpeningScript(empty, {
      decisorNome: null,
      market: {
        ...market,
        sazonalidadeAtiva: false,
        sazonalidade: null,
      },
    });
    expect(script).toContain("Olá aí, aqui é o Piloto da empresa de cidade.");
    expect(script).toContain("semana morta");
    expect(script).toContain("Como você tá lidando com as semanas mortas?");
    expect(script).toContain("conversa de 20 minutos");
    expect(script).not.toContain("especializados em marketing digital");
    expect(script).not.toContain("ferramenta");
  });

  it("fills identity slots and keeps the market motive", () => {
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
    expect(script).toContain("hamburgueria");
    expect(script).toContain("Dia dos Namorados");
    expect(script).toContain("conversa de 25 minutos");
    expect(script).not.toContain("Piloto");
    expect(script).not.toContain("especializados em");
  });

  it("uses a/e articles from tratamento", () => {
    expect(
      buildOpeningScript(
        { ...empty, como_chama: "Maria", tratamento: "a" },
        { decisorNome: "Ana", market },
      ),
    ).toContain("aqui é a Maria");
    expect(
      buildOpeningScript(
        { ...empty, como_chama: "Alex", tratamento: "e" },
        { decisorNome: "Ana", market },
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
    expect(beats?.[2]).toContain("conversa de 20 minutos");
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
    expect(next[2]).toContain("conversa de 20 minutos");
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

  it("does not put the placeholder into a filled market script", () => {
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
      ctaGlance("Queria te apresentar numa conversa de 25 minutos — sem compromisso.", 20),
    ).toBe("25 min · agenda?");
  });
});

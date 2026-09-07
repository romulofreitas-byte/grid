import { describe, expect, it } from "vitest";
import {
  cleanImportEmails,
  cleanImportPhones,
  cleanInstagram,
  cleanWebsite,
  findFormattedCnpj,
  looksLikeLiveNote,
  parseSocioNames,
  shortenMapsCompanyName,
} from "./import-clean";

describe("import clean", () => {
  it("drops sentry, image and placeholder emails", () => {
    expect(
      cleanImportEmails(
        "vendas@ceitelmetalurgica.com.br, 271e9fa@sentry.wixpress.com, visa@2x.png, exemplo@exemplo.com.br",
      ),
    ).toEqual(["vendas@ceitelmetalurgica.com.br"]);
  });

  it("keeps Brazilian phones and drops timestamps", () => {
    expect(
      cleanImportPhones("31 3411-3893, 1746169634904, 3333333333333, 5531998048403"),
    ).toEqual(["(31) 3411-3893", "(31) 99804-8403"]);
  });

  it("keeps real URLs and drops não encontrado", () => {
    expect(cleanWebsite("http://www.metalss.com.br/")).toBe("http://www.metalss.com.br");
    expect(cleanWebsite("não encontrado")).toBeUndefined();
    expect(cleanInstagram("https://www.instagram.com/metalurgicavaz/")).toMatch(
      /instagram\.com\/metalurgicavaz/i,
    );
    expect(cleanInstagram("não encontrado")).toBeUndefined();
    expect(
      cleanInstagram(
        "https://www.linkedin.com/company/super-laminacao-de-ferro-e-aco-ltda/",
      ),
    ).toBeUndefined();
  });

  it("splits sócios on slash and newline", () => {
    expect(
      parseSocioNames("MARCOS PANTUZZO / FRANCISCO PANTUZZO NETO\nPAULO IVO PANTUZZO"),
    ).toEqual([
      "MARCOS PANTUZZO",
      "FRANCISCO PANTUZZO NETO",
      "PAULO IVO PANTUZZO",
    ]);
  });

  it("shortens a Maps title after the first dash", () => {
    const shortened = shortenMapsCompanyName(
      "Aço Mais Betim - Ferragens, Treliças, Arames, Vergalhões",
    );
    expect(shortened.name).toBe("Aço Mais Betim");
    expect(shortened.original).toMatch(/Ferragens/);
  });

  it("detects live notes and finds a formatted CNPJ in another cell", () => {
    expect(
      looksLikeLiveNote("Isabela atendeu disse que contato só por email com o marcos"),
    ).toBe(true);
    expect(looksLikeLiveNote("Metalúrgica Vaz")).toBe(false);
    expect(
      findFormattedCnpj(["20230728100708", "11.222.333/0001-81", "(31) 3397-1020"]),
    ).toBe("11222333000181");
  });
});

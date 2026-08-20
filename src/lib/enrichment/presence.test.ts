import { describe, expect, it } from "vitest";
import {
  pickSocialHit,
  presenceQuery,
  titleMatchesCompany,
} from "./presence";

describe("titleMatchesCompany", () => {
  it("matches distinctive tokens from fantasia", () => {
    expect(
      titleMatchesCompany(
        "Marmoraria Carvalho | Itaúna",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe(true);
  });

  it("rejects unrelated titles", () => {
    expect(
      titleMatchesCompany(
        "Clínica odontológica Centro",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe(false);
  });
});

describe("pickSocialHit", () => {
  it("prefers a host match whose title has company tokens", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/outra",
            title: "Outra Loja",
          },
          {
            link: "https://instagram.com/marmorariacarvalho",
            title: "Marmoraria Carvalho Itauna",
          },
        ],
        "instagram.com",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe("https://instagram.com/marmorariacarvalho");
  });
});

describe("presenceQuery", () => {
  it("searches Instagram with fantasia first", () => {
    expect(
      presenceQuery(
        "instagram",
        "Marmoraria Carvalho",
        "MARMORARIA CARVALHO LTDA",
        "Itauna",
        "MG",
      ),
    ).toBe('site:instagram.com "Marmoraria Carvalho" Itauna MG');
  });
});

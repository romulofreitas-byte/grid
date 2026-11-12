import { describe, expect, it } from "vitest";
import {
  cnpjKey,
  omitHiddenContacts,
  phoneHideKey,
  phoneIsHidden,
  stripPhoneFromDealFields,
} from "./hidden-phones";
import type { ContactInfo } from "./types";

function contact(ddd: string, telefone: string): ContactInfo {
  return {
    ddd,
    telefone,
    seal: "NAO_CONFIRMADO",
    sharedCount: 1,
    label: "próprio",
    source: "receita",
  };
}

describe("phoneHideKey", () => {
  it("stores the same key for display and digits", () => {
    expect(phoneHideKey("(34) 99999-0000")).toBe(phoneHideKey("34999990000"));
    expect(phoneHideKey("+55 34 99999-0000")).toBe("5534999990000");
  });
});

describe("phoneIsHidden", () => {
  it("matches the ninth-digit form of the same line", () => {
    const hidden = [phoneHideKey("3433331010")!];
    expect(phoneIsHidden("(34) 3333-1010", hidden)).toBe(true);
    expect(phoneIsHidden("34933331010", hidden)).toBe(true);
    expect(phoneIsHidden("(34) 99999-0000", hidden)).toBe(false);
  });
});

describe("omitHiddenContacts", () => {
  it("drops the hidden line and keeps the next", () => {
    const hidden = [phoneHideKey("3133334444")!];
    const next = omitHiddenContacts(
      [contact("31", "33334444"), contact("31", "988887777")],
      hidden,
    );
    expect(next.map((row) => row.telefone)).toEqual(["988887777"]);
  });
});

describe("stripPhoneFromDealFields", () => {
  it("removes the number from the company, people and secretaries", () => {
    const next = stripPhoneFromDealFields(
      {
        phones: ["(34) 99999-0000", "(34) 3333-1010"],
        people: [{ name: "Ana", phone: "(34) 99999-0000", email: "" }],
        secretaries: [{ name: "Lia", phone: "3433331010", email: "" }],
      },
      "34999990000",
    );
    expect(next.phones).toEqual(["(34) 3333-1010"]);
    expect(next.people[0]?.phone).toBe("");
    expect(next.secretaries[0]?.phone).toBe("3433331010");
  });
});

describe("cnpjKey", () => {
  it("pads to 14 digits", () => {
    expect(cnpjKey("12.345.678/0001-90")).toBe("12345678000190");
    expect(cnpjKey("")).toBeNull();
  });
});

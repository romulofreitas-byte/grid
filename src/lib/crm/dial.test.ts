import { describe, expect, it } from "vitest";
import {
  dealDialPhones,
  firstDialablePhone,
  formatPhoneDisplay,
  telHrefFromPhone,
  uniquePhones,
  waHrefFromPhone,
} from "./dial";

describe("crm dial links", () => {
  it("builds tel and wa links from a Brazilian mobile", () => {
    expect(telHrefFromPhone("(34) 99999-0000")).toBe("tel:+5534999990000");
    expect(waHrefFromPhone("(34) 99999-0000")).toBe("https://wa.me/5534999990000");
  });

  it("picks the first number that can be dialed", () => {
    expect(firstDialablePhone(["", "abc", "(34) 3333-1010"])).toBe("(34) 3333-1010");
    expect(firstDialablePhone(["", "12"])).toBeNull();
  });

  it("drops duplicate numbers in different masks", () => {
    expect(
      uniquePhones(["(34) 3333-1010", "3433331010", "(11) 2303-4290"]),
    ).toEqual(["(34) 3333-1010", "(11) 2303-4290"]);
  });

  it("collects company and people phones for a deal card", () => {
    expect(
      dealDialPhones({
        phones: ["(11) 4123-3244", ""],
        people: [{ phone: "(11) 99999-0000" }, { phone: "" }],
      }),
    ).toEqual(["(11) 4123-3244", "(11) 99999-0000"]);
    expect(
      firstDialablePhone(
        dealDialPhones({ phones: [], people: [{ phone: "(11) 4123-3244" }] }),
      ),
    ).toBe("(11) 4123-3244");
  });

  it("formats a Brazilian number for the card face", () => {
    expect(formatPhoneDisplay("1141233244")).toBe("(11) 4123-3244");
  });
});

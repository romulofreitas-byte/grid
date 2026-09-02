import { describe, expect, it } from "vitest";
import {
  firstDialablePhone,
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
});

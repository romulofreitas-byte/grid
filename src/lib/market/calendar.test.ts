import { describe, expect, it } from "vitest";
import { mesNumero, nomeMes, peakCaption, peakMonths, seasonStatus } from "./calendar";

describe("seasonStatus", () => {
  it("marks the current month as agora", () => {
    expect(seasonStatus([8, 9], new Date("2026-08-17"))).toBe("agora");
  });

  it("marks the next month as na-porta", () => {
    expect(seasonStatus([9], new Date("2026-08-17"))).toBe("na-porta");
  });

  it("marks other months as fora", () => {
    expect(seasonStatus([2, 3], new Date("2026-08-17"))).toBe("fora");
  });

  it("returns nenhuma without a calendar", () => {
    expect(seasonStatus([], new Date("2026-08-17"))).toBe("nenhuma");
  });
});

describe("peakMonths", () => {
  it("sorts unique valid months", () => {
    expect(peakMonths([7, 1, 1, 2])).toEqual([1, 2, 7]);
  });
});

describe("month labels", () => {
  it("uses 1-based month numbers", () => {
    expect(mesNumero(new Date("2026-08-17"))).toBe(8);
    expect(nomeMes(8)).toBe("agosto");
  });
});

describe("peakCaption", () => {
  it("names peak months and says when the current month is outside", () => {
    expect(peakCaption([1, 2, 12], new Date("2026-08-17"))).toBe(
      "Pico: jan, fev, dez. agosto está fora do pico.",
    );
  });

  it("says when the current month is in the peak", () => {
    expect(peakCaption([1, 2, 8], new Date("2026-08-17"))).toBe(
      "Pico: jan, fev, ago. agosto está no pico.",
    );
  });
});

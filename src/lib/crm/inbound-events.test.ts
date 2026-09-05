import { describe, expect, it } from "vitest";
import {
  clipInboundPayload,
  inboundEventTone,
  inboundPayloadLine,
  snapshotInboundInput,
} from "./inbound-events";

describe("inbound events", () => {
  it("strips tokens from the JSON preview", () => {
    expect(
      clipInboundPayload({
        company: "Padaria",
        token: "secret",
        Authorization: "Bearer x",
        phone: "11999999999",
      }),
    ).toEqual({ company: "Padaria", phone: "11999999999" });
  });

  it("snapshots the mapped lead without dumping notes", () => {
    expect(
      snapshotInboundInput({
        company: "Oficina",
        name: "Ana",
        cnpj: "123",
        notes: "não entra",
      }),
    ).toEqual({
      company: "Oficina",
      name: "Ana",
      phone: "",
      email: "",
      cnpj: "123",
    });
    expect(inboundEventTone("created")).toBe("success");
    expect(inboundEventTone("error")).toBe("warning");
  });

  it("joins a short payload recap for the campaign log", () => {
    expect(
      inboundPayloadLine({
        company: "Padaria",
        phone: "11999999999",
        extra: "x",
        more: "y",
        skip: "z",
      }),
    ).toBe("company: Padaria · phone: 11999999999 · extra: x · more: y");
    expect(inboundPayloadLine(null)).toBe("");
  });
});

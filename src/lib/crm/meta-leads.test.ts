import { describe, expect, it } from "vitest";
import { mapMetaLeadToInbound, parseLeadgenPayload } from "./meta-leads";

describe("mapMetaLeadToInbound", () => {
  it("maps Instant Form fields to inbound JSON", () => {
    expect(
      mapMetaLeadToInbound({
        id: "lead1",
        field_data: [
          { name: "full_name", values: ["Maria Silva"] },
          { name: "email", values: ["maria@x.com"] },
          { name: "phone_number", values: ["11999999999"] },
          { name: "company_name", values: ["Padaria"] },
          { name: "volume", values: ["10 t"] },
        ],
      }),
    ).toEqual({
      kind: "person",
      name: "Maria Silva",
      email: "maria@x.com",
      phone: "11999999999",
      company: "Padaria",
      answers: { volume: "10 t" },
    });
  });

  it("joins first and last name when full_name is missing", () => {
    expect(
      mapMetaLeadToInbound({
        id: "lead2",
        field_data: [
          { name: "first_name", values: ["João"] },
          { name: "last_name", values: ["Souza"] },
        ],
      }),
    ).toMatchObject({ name: "João Souza" });
  });
});

describe("parseLeadgenPayload", () => {
  it("reads leadgen_id from a Graph webhook body", () => {
    expect(
      parseLeadgenPayload({
        entry: [
          {
            id: "page-1",
            changes: [
              {
                field: "leadgen",
                value: {
                  leadgen_id: "lg-9",
                  form_id: "form-3",
                  page_id: "page-1",
                },
              },
            ],
          },
        ],
      }),
    ).toEqual([
      { pageId: "page-1", formId: "form-3", leadgenId: "lg-9" },
    ]);
  });

  it("ignores other change fields", () => {
    expect(
      parseLeadgenPayload({
        entry: [{ id: "page-1", changes: [{ field: "feed", value: {} }] }],
      }),
    ).toEqual([]);
  });
});

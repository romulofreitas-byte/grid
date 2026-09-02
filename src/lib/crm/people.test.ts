import { describe, expect, it } from "vitest";
import {
  peopleFromDeal,
  sanitizePeople,
  sanitizeSecretaries,
  snapshotContactName,
} from "./people";

describe("crm people", () => {
  it("keeps secretaries off the people list", () => {
    expect(
      peopleFromDeal({
        contact_name: "Ana",
        secretaries: ["Bia", ""],
        people: [],
      }),
    ).toEqual([{ name: "Ana", phone: "", email: "" }]);
  });

  it("drops name-only extras that already live in secretaries", () => {
    expect(
      peopleFromDeal({
        contact_name: "Ana",
        secretaries: ["Bia"],
        people: [
          { name: "Ana", phone: "", email: "" },
          { name: "Bia", phone: "", email: "" },
          { name: "Carlos", phone: "(34) 99999-0000", email: "" },
        ],
      }),
    ).toEqual([
      { name: "Ana", phone: "", email: "" },
      { name: "Carlos", phone: "(34) 99999-0000", email: "" },
    ]);
  });

  it("keeps stored people and snapshots the principal for lead-sync", () => {
    const people = sanitizePeople([
      { name: "Carlos", phone: "(34) 99999-0000", email: "c@x.com" },
      { name: "Bia", phone: "", email: "" },
      { name: "", phone: "", email: "" },
    ]);
    expect(people).toHaveLength(2);
    expect(snapshotContactName(people)).toBe("Carlos");
  });

  it("trims empty secretary names", () => {
    expect(sanitizeSecretaries([" Bia ", "", "Lúcia"])).toEqual(["Bia", "Lúcia"]);
  });
});

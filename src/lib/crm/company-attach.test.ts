import { describe, expect, it } from "vitest";
import { crmCompanyAttachMode } from "./company-attach";

describe("crmCompanyAttachMode", () => {
  it("shows only the CNPJ on Grid deals that already came qualified", () => {
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "qualify_bridge",
        audited: true,
        briefingReady: true,
      }),
    ).toBe("cnpj");
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "catchup_bridge",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("cnpj");
  });

  it("offers qualify only for import or inbound companies still unaudited", () => {
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "import",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("qualify");
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "inbound",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("qualify");
  });

  it("hides qualify until briefing is ready and after the ficha exists", () => {
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "import",
        audited: false,
        briefingReady: false,
      }),
    ).toBe("cnpj");
    expect(
      crmCompanyAttachMode({
        cnpj: "00012847000510",
        source: "inbound",
        audited: true,
        briefingReady: true,
      }),
    ).toBe("cnpj");
  });

  it("lets import and inbound leads without CNPJ search the Grid", () => {
    expect(
      crmCompanyAttachMode({
        cnpj: null,
        source: "import",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("search");
    expect(
      crmCompanyAttachMode({
        cnpj: null,
        source: "inbound",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("search");
  });

  it("does not offer qualify on a manual add that already has a CNPJ", () => {
    expect(
      crmCompanyAttachMode({
        cnpj: "12345678000190",
        source: "crm_add",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("cnpj");
    expect(
      crmCompanyAttachMode({
        cnpj: null,
        source: "crm_add",
        audited: false,
        briefingReady: true,
      }),
    ).toBe("search");
  });
});

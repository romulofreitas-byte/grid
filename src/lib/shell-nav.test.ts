import { describe, expect, it } from "vitest";
import {
  footerItemKey,
  isFooterAccordion,
  isShellChildActive,
  isShellFooterActive,
  isShellFooterGroupActive,
  isShellMoreActive,
  isShellNavActive,
  showsOpeningNav,
  SHELL_FOOTER_NAV,
  SHELL_MOBILE_NAV,
  SHELL_MORE_NAV,
  SHELL_WORK_NAV,
} from "./shell-nav";

describe("shell work nav", () => {
  it("keeps the work destinations and the Nova lista tour target", () => {
    expect(SHELL_WORK_NAV.map((item) => item.href)).toEqual([
      "/painel",
      "/metas",
      "/box",
      "/crm",
      "/largada",
      "/listas",
      "/empresas",
    ]);
    expect(SHELL_WORK_NAV.find((item) => item.href === "/largada")?.tour).toBe(
      "nova-lista",
    );
  });
});

describe("shell mobile nav", () => {
  it("keeps four phone destinations: Ligar, CRM, Listas, and Mais", () => {
    expect(SHELL_MOBILE_NAV.map((item) => item.href)).toEqual([
      "/box",
      "/crm",
      "/listas",
    ]);
    expect(SHELL_MORE_NAV.map((item) => item.href)).toEqual([
      "/painel",
      "/metas",
      "/largada",
      "/empresas",
    ]);
    expect(SHELL_MORE_NAV.find((item) => item.href === "/largada")?.tour).toBe(
      "nova-lista",
    );
  });

  it("lights Mais on Painel, Nova lista, Empresas, and Meta", () => {
    expect(isShellMoreActive("/painel")).toBe(true);
    expect(isShellMoreActive("/largada")).toBe(true);
    expect(isShellMoreActive("/empresas")).toBe(true);
    expect(isShellMoreActive("/metas")).toBe(true);
    expect(isShellMoreActive("/box")).toBe(false);
    expect(isShellMoreActive("/crm")).toBe(false);
    expect(isShellMoreActive("/listas")).toBe(false);
  });
});

describe("shell footer nav", () => {
  it("keeps five permanent items, with Telefonia under Integrações", () => {
    expect(SHELL_FOOTER_NAV.map((item) => item.label)).toEqual([
      "Conta",
      "Integrações",
      "Planos",
      "Dúvidas",
      "Sair",
    ]);
    const integracoes = SHELL_FOOTER_NAV.find(
      (item) => item.label === "Integrações",
    );
    expect(isFooterAccordion(integracoes!)).toBe(true);
    expect(integracoes?.href).toBeUndefined();
    expect(integracoes?.children?.map((child) => child.label)).toEqual([
      "Conectar conta",
      "Captar leads",
      "Avançado",
      "Importações",
      "Telefonia",
    ]);
    expect(integracoes?.children?.map((child) => child.href)).toEqual([
      "/integracoes",
      "/automacoes",
      "/automacoes/avancado",
      "/importacoes",
      "/integracoes/telefonia",
    ]);
    expect(SHELL_FOOTER_NAV.find((item) => item.action === "logout")?.label).toBe(
      "Sair",
    );
    expect(SHELL_FOOTER_NAV.every((item) => footerItemKey(item).length > 0)).toBe(
      true,
    );
  });
});

describe("isShellNavActive", () => {
  it("matches the route and nested paths, not siblings", () => {
    expect(isShellNavActive("/painel", "/painel")).toBe(true);
    expect(isShellNavActive("/crm", "/crm")).toBe(true);
    expect(isShellNavActive("/largada", "/largada")).toBe(true);
    expect(isShellNavActive("/listas", "/listas/abc")).toBe(true);
    expect(isShellNavActive("/painel", "/")).toBe(false);
    expect(isShellNavActive("/listas", "/listas-x")).toBe(false);
  });
});

describe("showsOpeningNav", () => {
  it("marks CRM, Ligar, and Meta while the destination is still loading", () => {
    expect(showsOpeningNav("/crm")).toBe(true);
    expect(showsOpeningNav("/box")).toBe(true);
    expect(showsOpeningNav("/metas")).toBe(true);
    expect(showsOpeningNav("/painel")).toBe(false);
  });
});

describe("isShellChildActive", () => {
  const integracoes = SHELL_FOOTER_NAV.find(
    (item) => item.label === "Integrações",
  );
  const telefonia = integracoes?.children?.find(
    (child) => child.href === "/integracoes/telefonia",
  );
  const importacoes = integracoes?.children?.find(
    (child) => child.href === "/importacoes",
  );
  const facebook = integracoes?.children?.find(
    (child) => child.href === "/integracoes",
  );
  const captar = integracoes?.children?.find(
    (child) => child.href === "/automacoes",
  );
  const avancado = integracoes?.children?.find(
    (child) => child.href === "/automacoes/avancado",
  );

  it("lights Integrações children from path", () => {
    expect(
      telefonia && isShellChildActive(telefonia, "/integracoes/telefonia", null),
    ).toBe(true);
    expect(
      facebook && isShellChildActive(facebook, "/integracoes", null),
    ).toBe(true);
    expect(
      facebook && isShellChildActive(facebook, "/integracoes/telefonia", null),
    ).toBe(false);
    expect(
      telefonia && isShellChildActive(telefonia, "/integracoes", null),
    ).toBe(false);
    expect(isShellFooterGroupActive(integracoes!, "/integracoes", null)).toBe(
      true,
    );
    expect(
      importacoes && isShellChildActive(importacoes, "/importacoes", null),
    ).toBe(true);
    expect(
      importacoes && isShellChildActive(importacoes, "/automacoes", null),
    ).toBe(false);
    expect(captar && isShellChildActive(captar, "/automacoes", null)).toBe(true);
    expect(
      captar && isShellChildActive(captar, "/automacoes/avancado", null),
    ).toBe(false);
    expect(
      captar && isShellChildActive(captar, "/automacoes/meta", null),
    ).toBe(false);
    expect(
      avancado && isShellChildActive(avancado, "/automacoes/avancado", null),
    ).toBe(true);
    expect(
      facebook && isShellChildActive(facebook, "/automacoes/meta", null),
    ).toBe(true);
    expect(
      isShellFooterGroupActive(integracoes!, "/automacoes/meta", null),
    ).toBe(true);
  });
});

describe("isShellFooterActive", () => {
  const integracoes = SHELL_FOOTER_NAV.find(
    (item) => item.label === "Integrações",
  )!;
  const conta = SHELL_FOOTER_NAV.find((item) => item.href === "/conta")!;

  it("keeps selection on the child page, not on Integrações", () => {
    expect(isShellFooterActive(integracoes, "/integracoes/telefonia", null)).toBe(
      false,
    );
    expect(
      isShellFooterGroupActive(integracoes, "/integracoes/telefonia", null),
    ).toBe(true);
    expect(isShellFooterGroupActive(integracoes, "/importacoes", null)).toBe(
      true,
    );
    expect(isShellFooterGroupActive(integracoes, "/conta", null)).toBe(false);
    expect(isShellFooterActive(conta, "/conta", null)).toBe(true);
    expect(isShellFooterActive(conta, "/integracoes/telefonia", null)).toBe(
      false,
    );
  });
});

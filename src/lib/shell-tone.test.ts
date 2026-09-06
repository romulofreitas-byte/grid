import { describe, expect, it } from "vitest";
import {
  hrefPathname,
  pathMatchesDest,
  pathShellTone,
  sameOriginNavHref,
} from "./shell-tone";

describe("pathShellTone", () => {
  it("is light only on the Box session", () => {
    expect(pathShellTone("/box")).toBe("light");
    expect(pathShellTone("/box/")).toBe("light");
    expect(pathShellTone("/painel")).toBe("dark");
    expect(pathShellTone("/crm")).toBe("dark");
    expect(pathShellTone("/box-office")).toBe("dark");
  });
});

describe("hrefPathname", () => {
  const origin = "http://localhost:3000";

  it("reads internal paths and ignores other origins", () => {
    expect(hrefPathname("/box", origin)).toBe("/box");
    expect(hrefPathname("/box?from=/painel", origin)).toBe("/box");
    expect(hrefPathname("http://localhost:3000/crm", origin)).toBe("/crm");
    expect(hrefPathname("https://example.com/box", origin)).toBeNull();
    expect(hrefPathname("#fila", origin)).toBeNull();
    expect(hrefPathname(null, origin)).toBeNull();
  });
});

describe("sameOriginNavHref", () => {
  const origin = "http://localhost:3000";

  it("keeps search and hash for the router", () => {
    expect(sameOriginNavHref("/box?from=/crm#fila", origin)).toBe(
      "/box?from=/crm#fila",
    );
    expect(sameOriginNavHref("https://example.com/box", origin)).toBeNull();
  });
});

describe("pathMatchesDest", () => {
  it("matches the route without treating /box-office as /box", () => {
    expect(pathMatchesDest("/box", "/box")).toBe(true);
    expect(pathMatchesDest("/box/", "/box")).toBe(true);
    expect(pathMatchesDest("/box/hoje", "/box")).toBe(true);
    expect(pathMatchesDest("/box-office", "/box")).toBe(false);
    expect(pathMatchesDest("/crm", "/box")).toBe(false);
  });
});

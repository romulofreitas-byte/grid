import { describe, expect, it } from "vitest";
import {
  crmNichoRailClosedForLogin,
  exclusiveCrmRails,
  parseShellRailExpanded,
  parseShellRailOpen,
  resolveShellRailOpen,
  serializeShellRailOpen,
  shellRailLoginMarkerPresent,
  shellRailWidthClass,
} from "./shell-rail";

describe("shell rail persistence", () => {
  it("defaults to open so labels teach the IA", () => {
    expect(parseShellRailOpen(null)).toBe(true);
    expect(parseShellRailOpen("")).toBe(true);
    expect(parseShellRailOpen("maybe")).toBe(true);
  });

  it("round-trips the explicit open and closed flags", () => {
    expect(parseShellRailOpen("1")).toBe(true);
    expect(parseShellRailOpen("0")).toBe(false);
    expect(serializeShellRailOpen(true)).toBe("1");
    expect(serializeShellRailOpen(false)).toBe("0");
  });
});

describe("resolveShellRailOpen", () => {
  it("opens on login even when the rail was collapsed", () => {
    expect(resolveShellRailOpen("0", true)).toBe(true);
  });

  it("keeps a collapsed rail when this visit is not a login", () => {
    expect(resolveShellRailOpen("0", false)).toBe(false);
  });

  it("stays open when nothing was stored", () => {
    expect(resolveShellRailOpen(null, false)).toBe(true);
    expect(resolveShellRailOpen("", false)).toBe(true);
  });
});

describe("shell rail login marker", () => {
  it("reads only the login cookie", () => {
    expect(shellRailLoginMarkerPresent(null)).toBe(false);
    expect(shellRailLoginMarkerPresent("")).toBe(false);
    expect(shellRailLoginMarkerPresent("grid-shell-rail-login=0")).toBe(false);
    expect(
      shellRailLoginMarkerPresent("other=1; grid-shell-rail-login=1"),
    ).toBe(true);
  });
});

describe("crmNichoRailClosedForLogin", () => {
  it("closes the nicho rail and keeps its width", () => {
    expect(
      crmNichoRailClosedForLogin(JSON.stringify({ open: true, width: 200 })),
    ).toBe(JSON.stringify({ open: false, width: 200 }));
  });

  it("leaves a missing pref alone", () => {
    expect(crmNichoRailClosedForLogin(null)).toBeNull();
    expect(crmNichoRailClosedForLogin("not-json")).toBeNull();
  });
});

describe("shellRailWidthClass", () => {
  it("keeps the collapsed rail at icon width", () => {
    expect(shellRailWidthClass(true)).toBe("w-[12.5rem]");
    expect(shellRailWidthClass(false)).toBe("w-16");
  });
});

describe("shell rail accordion persistence", () => {
  it("keeps a named submenu and treats blank as closed", () => {
    expect(parseShellRailExpanded(null)).toBeNull();
    expect(parseShellRailExpanded("")).toBeNull();
    expect(parseShellRailExpanded("  ")).toBeNull();
    expect(parseShellRailExpanded("Integrações")).toBe("Integrações");
  });
});

describe("exclusiveCrmRails", () => {
  it("opens the shell and closes the nicho", () => {
    expect(
      exclusiveCrmRails(
        { shellOpen: false, nichoOpen: true },
        { shellOpen: true },
      ),
    ).toEqual({ shellOpen: true, nichoOpen: false });
  });

  it("opens the nicho and collapses the shell", () => {
    expect(
      exclusiveCrmRails(
        { shellOpen: true, nichoOpen: false },
        { nichoOpen: true },
      ),
    ).toEqual({ shellOpen: false, nichoOpen: true });
  });

  it("allows both rails closed", () => {
    expect(
      exclusiveCrmRails(
        { shellOpen: false, nichoOpen: true },
        { nichoOpen: false },
      ),
    ).toEqual({ shellOpen: false, nichoOpen: false });
    expect(
      exclusiveCrmRails(
        { shellOpen: true, nichoOpen: false },
        { shellOpen: false },
      ),
    ).toEqual({ shellOpen: false, nichoOpen: false });
  });

  it("collapses the shell when hydrating with both already open", () => {
    expect(
      exclusiveCrmRails({ shellOpen: true, nichoOpen: true }),
    ).toEqual({ shellOpen: false, nichoOpen: true });
  });
});

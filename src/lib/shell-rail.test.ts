import { describe, expect, it } from "vitest";
import {
  parseShellRailExpanded,
  parseShellRailOpen,
  serializeShellRailOpen,
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

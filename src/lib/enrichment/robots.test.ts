import { describe, expect, it } from "vitest";
import { pathAllowedByRobots } from "./robots";

const SAMPLE = `User-agent: *
Disallow: /admin

User-agent: GridBot
Disallow: /contato
Allow: /
`;

describe("pathAllowedByRobots", () => {
  it("skips /contato when GridBot is disallowed there", () => {
    expect(pathAllowedByRobots(SAMPLE, "/contato")).toBe(false);
  });

  it("allows the home when not blocked", () => {
    expect(pathAllowedByRobots(SAMPLE, "/")).toBe(true);
  });

  it("allows /sobre when only /contato is blocked", () => {
    expect(pathAllowedByRobots(SAMPLE, "/sobre")).toBe(true);
  });
});
